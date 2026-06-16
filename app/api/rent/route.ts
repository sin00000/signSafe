import { NextRequest, NextResponse } from 'next/server';
import { PropertyType } from '@/types/rent';
import { parseRentXml } from '@/lib/parseRentXml';
import { buildAnalysis, buildNoDataResult } from '@/lib/riskAnalysis';
import { getPreviousMonths } from '@/lib/dateUtils';

const API_URLS: Record<PropertyType, string> = {
  apartment: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  villa:     'https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  officetel: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent',
  detached:  'https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent',
};

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const propertyType    = p.get('propertyType') as PropertyType | null;
  const lawdCd          = p.get('lawdCd');
  const dealYm          = p.get('dealYm');
  const depositStr      = p.get('deposit');
  const monthlyStr      = p.get('monthlyRent') ?? '0';
  const address         = p.get('address') ?? '';

  // 추가 분석 파라미터
  const housePriceStr   = p.get('housePrice');
  const mortgageStr     = p.get('mortgageAmount');
  const hasMortgageStr  = p.get('hasMortgage');
  const hasPriorStr     = p.get('hasPriorLiens');
  const isOwnerStr      = p.get('isOwnerMatch');
  const canRegStr       = p.get('canRegister');
  const canDateStr      = p.get('canGetFixedDate');
  const canInsureStr    = p.get('canInsure');
  const areaStr         = p.get('area');         // 전용면적(㎡) — 있으면 비슷한 평형끼리 비교해 정확도를 높임
  const dongName        = p.get('dongName') ?? '';

  /* ── 검증 ─────────────────────────── */
  if (!propertyType || !lawdCd || !dealYm || !depositStr) {
    return NextResponse.json({ status: 'error', errorMessage: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
  }

  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ status: 'error', errorMessage: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  const baseUrl = API_URLS[propertyType];
  if (!baseUrl) {
    return NextResponse.json({ status: 'error', errorMessage: '지원하지 않는 주택유형입니다.' }, { status: 400 });
  }

  // 파라미터 파싱
  const userDeposit      = (parseInt(depositStr) || 0) * 10_000;
  const userMonthlyRent  = (parseInt(monthlyStr) || 0) * 10_000;
  const parseBool = (s: string | null) => s === null ? null : s === 'true';

  const extra = {
    housePrice:       housePriceStr  ? parseInt(housePriceStr) : null,
    mortgageAmount:   mortgageStr    ? parseInt(mortgageStr)   : null,
    hasMortgage:      parseBool(hasMortgageStr),
    hasPriorLiens:    parseBool(hasPriorStr),
    isOwnerMatch:     parseBool(isOwnerStr),
    canRegister:      parseBool(canRegStr),
    canGetFixedDate:  parseBool(canDateStr),
    canInsure:        parseBool(canInsureStr),
  };

  /* ── 최근 4개월 순차 조회 ───────────
   * 실거래가 데이터는 1~1.5개월의 신고 지연이 있어 미래 월에는 데이터가 없다.
   * "계약 예정월"이 현재보다 미래라면, 비교 기준을 현재 시점의 최신 데이터로 당겨와
   * 검색 결과가 0건이 되는 것을 방지한다 (계약은 미래에 해도 시세는 최신 기준이 더 유의미). */
  const now = new Date();
  const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const anchorYm = dealYm > currentYm ? currentYm : dealYm;
  const months = getPreviousMonths(anchorYm, 4);
  const allTransactions: ReturnType<typeof parseRentXml> = [];
  const searchedMonths: string[] = [];

  for (const month of months) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('serviceKey', apiKey);
      url.searchParams.set('LAWD_CD',   lawdCd);
      url.searchParams.set('DEAL_YMD',  month);
      url.searchParams.set('numOfRows', '1000');
      url.searchParams.set('pageNo',    '1');

      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) { console.error(`HTTP ${res.status} for month ${month}`); continue; }

      const xml = await res.text();
      const items = parseRentXml(xml, propertyType);

      if (items.length > 0) {
        allTransactions.push(...items);
        searchedMonths.push(month);
      }
    } catch (err) {
      console.error(`API error (${month}):`, err);
    }
  }

  const base = { propertyType, address, lawdCd, dealYm, searchedMonths, userDeposit, userMonthlyRent };

  // 동 단위 필터: 같은 법정동 거래만 먼저 추린다.
  // "역삼1동"·"역삼2동" 같은 행정동 분리를 흡수하기 위해 끝의 숫자를 제거한 기본 이름으로 비교.
  // 10건 미만이면 시군구 전체로 폴백해 표본 부족으로 인한 왜곡을 방지한다.
  const DONG_MIN = 10;
  let scopeTransactions = allTransactions;
  if (dongName) {
    const dongBase = dongName.replace(/\d+동$/, '동').trim();
    const byDong = allTransactions.filter(t => t.dong.replace(/\d+동$/, '동').trim() === dongBase);
    if (byDong.length >= DONG_MIN) scopeTransactions = byDong;
  }

  // 전용면적이 입력된 경우, 평형이 비슷한(±20%) 거래만 추려 시세 비교의 정확도를 높인다.
  // 같은 동네라도 평형 차이가 크면 보증금 중앙값이 크게 달라지기 때문 — 단, 비슷한 거래가
  // 너무 적으면(3건 미만) 표본이 부족해 오히려 왜곡되므로 동 범위 거래로 대체한다.
  const userArea = areaStr ? parseFloat(areaStr) : null;
  let comparableTransactions = scopeTransactions;
  if (userArea && userArea > 0) {
    const similar = scopeTransactions.filter(t => t.area > 0 && Math.abs(t.area - userArea) / userArea <= 0.2);
    if (similar.length >= 3) comparableTransactions = similar;
  }

  /* ── 데이터 부족 ─────────────────── */
  if (allTransactions.length < 3) {
    // 데이터 없어도 추가 입력 기반 위험 요소는 분석 가능
    const noData = buildNoDataResult(base);
    const withExtra = buildAnalysis({ transactions: [], ...base, ...extra });

    if (withExtra.riskFactors.length > 0) {
      // riskLevel/riskTitle/riskMessage/riskFactors는 모두 같은 분석(withExtra)에서 가져와
      // 서로 모순되지 않도록 한다 (예: "주의" 배지에 "자료 부족" 제목이 뜨는 일이 없도록)
      return NextResponse.json({
        ...noData,
        riskFactors: withExtra.riskFactors,
        riskLevel: withExtra.riskLevel,
        riskTitle: withExtra.riskTitle,
        riskMessage: withExtra.riskMessage,
        reasonSummary: [...noData.reasonSummary, ...withExtra.reasonSummary],
        requiredChecks: withExtra.requiredChecks,
        jeonseRate: withExtra.jeonseRate,
        isKangtonJeonse: withExtra.isKangtonJeonse,
      });
    }
    return NextResponse.json(noData);
  }

  /* ── 분석 ────────────────────────── */
  const result = buildAnalysis({ transactions: comparableTransactions, ...base, ...extra });
  return NextResponse.json(result);
}
