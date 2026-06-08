/**
 * /api/analyze — 전체 위험 분석 통합 라우트
 *
 * 흐름:
 * 1. 입력값 검증
 * 2. API 레지스트리에서 해당 주택유형의 API 목록 추출
 * 3. 최근 4개월 데이터 병렬 조회
 * 4. 각 분석 모듈 실행 → riskSignals 수집
 * 5. riskDecision으로 최종 신호등 판정
 * 6. 결과 반환 (점수 미노출)
 */
import { NextRequest, NextResponse } from 'next/server';
import { PropertyType, UserInput, RiskSignal } from '@/types/rent';
import { API_REGISTRY, getApisForPropertyType } from '@/lib/apiRegistry';
import { getPreviousMonths } from '@/lib/dateUtils';
import {
  parseRentXml, parseSaleXml, parseBuildingXml,
  parseAptOfficialPriceJson, parseIndvdOfficialPriceJson,
  parseBrokerJson,
} from '@/lib/parseRentXml';
import { analyzePriceRisk }    from '@/lib/priceAnalysis';
import { analyzeBuildingRisk } from '@/lib/buildingAnalysis';
import { analyzeDocumentRisk } from '@/lib/documentAnalysis';
import { decide }              from '@/lib/riskDecision';
import { unknown as unknownSignal } from '@/lib/riskSignals';

/* ── 1개 URL 안전 조회 ─────────────────────────────────── */
async function fetchSafe(url: string, responseType: 'xml' | 'json'): Promise<string | object | null> {
  try {
    const isVworld = url.includes('vworld.kr');
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: isVworld
        // vworld ned API는 도메인 화이트리스트 검증 → Referer 필수
        ? { 'Referer': 'https://www.vworld.kr', 'Origin': 'https://www.vworld.kr' }
        : {},
    });
    if (!res.ok) return null;
    if (responseType === 'json') return await res.json();
    return await res.text();
  } catch (err) {
    console.error('fetch error:', url.slice(0, 60), err);
    return null;
  }
}

/* ── 여러 달 실거래가 조회 ─────────────────────────────── */
async function fetchMultiMonth(
  apiId: string,
  propertyType: PropertyType,
  lawdCd: string,
  dealYm: string,
  months = 4,
): Promise<{ xml: string; month: string }[]> {
  const api = API_REGISTRY.find(a => a.id === apiId);
  if (!api || !api.enabled) return [];
  const monthList = getPreviousMonths(dealYm, months);
  const results = await Promise.all(
    monthList.map(async m => {
      const url = api.buildUrl({
        lawdCd, dealYm: m, propertyType,
        apiKey: process.env.DATA_GO_KR_API_KEY ?? '',
      });
      if (!url) return null;
      const raw = await fetchSafe(url, 'xml');
      return raw ? { xml: raw as string, month: m } : null;
    })
  );
  return results.filter((r): r is { xml: string; month: string } => r !== null);
}

/* ── 메인 핸들러 ───────────────────────────────────────── */
export async function POST(request: NextRequest) {
  let input: Partial<UserInput>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const {
    lawdCd, propertyType = 'apartment', deposit, monthlyRent = 0,
    dealYm = '', bankDebt = 0,
    sigunguCd, bjdongCd, pnu,
    area, buildingName = '', priorTenantDeposit = 0,
    brokerName, brokerRegNo,
    isOwnerMatch, hasSeizure, canRegister, canGetFixedDate, canInsure,
  } = input as UserInput & { bankDebt?: number; pnu?: string; area?: number | null; buildingName?: string; priorTenantDeposit?: number };

  const allSignals: RiskSignal[] = [];
  const searchedMonths: string[] = [];

  // ── 필수값 없으면 회색불 ───────────────────────────────
  if (!lawdCd || !deposit || !dealYm) {
    allSignals.push(unknownSignal(
      'missing_required_input', 'unknown',
      '분석에 필요한 정보가 부족합니다',
      '주소(구 단위), 보증금, 계약 예정월은 시세 비교 분석에 필요합니다.',
      '미입력 항목: ' + [!lawdCd && '주소', !deposit && '보증금', !dealYm && '계약월'].filter(Boolean).join(', '),
      '정보를 입력하면 더 정확한 분석을 제공합니다.',
      '사용자 입력',
    ));
    const doc = analyzeDocumentRisk(input as UserInput);
    allSignals.push(...doc);
    return NextResponse.json({ decision: decide(allSignals), signals: allSignals });
  }

  const depositWon     = deposit * 10_000;
  const bankDebtWon    = (bankDebt ?? 0) * 10_000;
  const monthlyRentWon = (monthlyRent ?? 0) * 10_000;

  // ── 모든 외부 API 병렬 호출 ─────────────────────────────
  const rentApiId: Record<PropertyType, string> = {
    apartment: 'rent_apartment', villa: 'rent_villa',
    officetel: 'rent_officetel', detached: 'rent_detached',
  };
  const saleApiId: Record<PropertyType, string> = {
    apartment: 'sale_apartment', villa: 'sale_villa',
    officetel: 'sale_officetel', detached: 'sale_detached',
  };
  const officialApiId = ['apartment', 'villa', 'officetel'].includes(propertyType)
    ? 'price_apartment_official' : 'price_individual_official';
  const officialApi = API_REGISTRY.find(a => a.id === officialApiId);
  const buildingApi  = API_REGISTRY.find(a => a.id === 'building_registry');

  // 공시가격: PNU 있을 때만 조회 가능
  const officialUrl = (officialApi?.enabled && pnu) ? officialApi.buildUrl({
    lawdCd, propertyType, pnu,
    apiKey:   process.env.DATA_GO_KR_API_KEY ?? '',
    extraKey: officialApiId === 'price_apartment_official'
      ? process.env.VWORLD_APT_KEY : process.env.VWORLD_INDVD_KEY,
  }) : null;

  // 건축물대장: bjdongCd 있으면 동 단위, 없으면 sigunguCd만으로 시도
  const effectiveSigunguCd = sigunguCd ?? lawdCd;
  const buildingUrl = (buildingApi?.enabled && effectiveSigunguCd)
    ? buildingApi.buildUrl({
        sigunguCd: effectiveSigunguCd,
        bjdongCd:  bjdongCd ?? undefined,
        propertyType,
        apiKey: process.env.DATA_GO_KR_API_KEY ?? '',
      })
    : null;

  // 전월세(4개월) · 매매(6개월) · 공시가격 · 건축물대장 동시 실행
  const [rentResults, saleResults, officialRaw, buildingRaw] = await Promise.all([
    fetchMultiMonth(rentApiId[propertyType],  propertyType, lawdCd, dealYm, 4),
    fetchMultiMonth(saleApiId[propertyType],  propertyType, lawdCd, dealYm, 6),
    officialUrl ? fetchSafe(officialUrl, 'json') : Promise.resolve(null),
    buildingUrl ? fetchSafe(buildingUrl, 'xml')  : Promise.resolve(null),
  ]);

  const rentTransactions = rentResults.flatMap(r => parseRentXml(r.xml, propertyType));
  rentResults.forEach(r => searchedMonths.push(r.month));
  const saleTransactions = saleResults.flatMap(r => parseSaleXml(r.xml, propertyType));

  const officialPrice = officialRaw
    ? (officialApiId === 'price_apartment_official'
        ? parseAptOfficialPriceJson(officialRaw)
        : parseIndvdOfficialPriceJson(officialRaw))
    : null;

  const buildingInfo = buildingRaw ? parseBuildingXml(buildingRaw as string) : null;

  // ── 분석 모듈 실행 ────────────────────────────────────
  const priceSignals = analyzePriceRisk({
    userDeposit:          depositWon,
    userMonthlyRent:      monthlyRentWon,
    rentTransactions,
    saleTransactions,
    officialPrice,
    bankDebt:             bankDebtWon,
    priorTenantDeposit:   (priorTenantDeposit ?? 0) * 10_000,
    propertyType,
    searchedMonths,
    area:                 area ?? null,
    buildingName:         buildingName ?? '',
    dongName:             (input as { dongName?: string }).dongName ?? '',
    floor:                (input as { floor?: number | null }).floor ?? null,
    buildingAgeDays:      buildingInfo?.buildingAgeDays ?? 0,
    isSeoul:              lawdCd?.startsWith('11') ?? false,
  });
  allSignals.push(...priceSignals);
  allSignals.push(...analyzeBuildingRisk(buildingInfo, propertyType));
  allSignals.push(...analyzeDocumentRisk(input as UserInput));

  // ── 최종 판정 (내부 점수 노출 안 함) ─────────────────
  const decision = decide(allSignals);

  return NextResponse.json({
    decision,
    signals: allSignals,
    meta: {
      rentCount: rentTransactions.length,
      saleCount: saleTransactions.length,
      searchedMonths,
    },
  });
}
