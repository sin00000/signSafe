import { XMLParser } from 'fast-xml-parser';
import { RentTransaction, SaleTransaction, BuildingInfo, PropertyType } from '@/types/rent';
import { parsePublicApiAmount } from './formatMoney';

const parser = new XMLParser({
  parseTagValue: true,
  trimValues: true,
  parseAttributeValue: false,
  ignoreAttributes: true,
});

function extractItems(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const body = (parsed?.response as Record<string, unknown>)?.body as Record<string, unknown> | undefined;
  const items = (body?.items as Record<string, unknown>)?.item;
  if (!items) return [];
  return Array.isArray(items) ? items as Record<string, unknown>[] : [items as Record<string, unknown>];
}

function get(item: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && item[k] !== '') return item[k];
  }
  return undefined;
}

/* ── 전월세 파서 ──────────────────────────────────────────── */
// 신규 API: 영문 필드명 (deposit, monthlyRent, aptNm, excluUseAr, dealYear, dealMonth, floor)
// 구 API: 한글 필드명 (보증금액, 월세금액, 아파트, 전용면적, 년, 월, 층) — 하위 호환
export function parseRentXml(xml: string, _type: PropertyType): RentTransaction[] {
  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    return extractItems(parsed).map(item => ({
      deposit:      parsePublicApiAmount((get(item, 'deposit', '보증금액', '보증금') ?? 0) as string | number),
      monthlyRent:  parsePublicApiAmount((get(item, 'monthlyRent', '월세금액', '월세') ?? 0) as string | number),
      area:         parseFloat(String(get(item, 'excluUseAr', '전용면적', '면적') ?? '0')) || 0,
      buildingName: String(get(item, 'aptNm', 'mhouseNm', '아파트', '단지명', '건물명') ?? ''),
      year:         parseInt(String(get(item, 'dealYear', '년', '계약년') ?? '0')),
      month:        parseInt(String(get(item, 'dealMonth', '월', '계약월') ?? '0')),
      floor:        parseInt(String(get(item, 'floor', '층') ?? '0')),
      dong:         String(get(item, 'umdNm', 'ldong', '법정동', '법정동명') ?? ''),
    }));
  } catch { return []; }
}

/* ── 매매 파서 ────────────────────────────────────────────── */
// 신규 API: dealAmount (매매가), aptNm, excluUseAr, dealYear, dealMonth, floor
export function parseSaleXml(xml: string, _type: PropertyType): SaleTransaction[] {
  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    return extractItems(parsed).map(item => ({
      price:        parsePublicApiAmount((get(item, 'dealAmount', '거래금액', '물건금액') ?? 0) as string | number),
      area:         parseFloat(String(get(item, 'excluUseAr', '전용면적', '면적') ?? '0')) || 0,
      buildingName: String(get(item, 'aptNm', 'mhouseNm', '아파트', '단지명', '건물명') ?? ''),
      year:         parseInt(String(get(item, 'dealYear', '년', '계약년') ?? '0')),
      month:        parseInt(String(get(item, 'dealMonth', '월', '계약월') ?? '0')),
      floor:        parseInt(String(get(item, 'floor', '층') ?? '0')),
      dong:         String(get(item, 'umdNm', 'ldong', '법정동', '법정동명') ?? ''),
    }));
  } catch { return []; }
}

/* ── 건축물대장 파서 ─────────────────────────────────────── */
export function parseBuildingXml(xml: string): BuildingInfo | null {
  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const items = extractItems(parsed);
    if (!items.length) return null;
    const item = items[0];

    const approvalDateRaw = String(get(item, '사용승인일', 'useAprDay') ?? '');
    const approvalDate = approvalDateRaw.replace(/\D/g, '').slice(0, 8);

    let ageDays = 0;
    if (approvalDate.length === 8) {
      const y = parseInt(approvalDate.slice(0, 4));
      const m = parseInt(approvalDate.slice(4, 6)) - 1;
      const d = parseInt(approvalDate.slice(6, 8));
      ageDays = Math.floor((Date.now() - new Date(y, m, d).getTime()) / 86_400_000);
    }

    const usage = String(get(item, '주요용도코드명', 'mainPurpsCdNm', '주용도코드명') ?? '');
    const violRaw = String(get(item, '위반건축물여부', 'violBuildingYn') ?? 'N');

    return {
      mainUsage: usage,
      violationBuilding: violRaw.trim().toUpperCase() === 'Y',
      approvalDate,
      buildingAgeDays: ageDays,
      address: String(get(item, '대지위치', 'platPlc', '주소') ?? ''),
    };
  } catch { return null; }
}

/* ── 공동주택 공시가격 파서 (vworld JSON) ─────────────────── */
export function parseAptOfficialPriceJson(raw: unknown): number | null {
  try {
    const obj = raw as Record<string, unknown>;
    const list = (obj?.apartHousingPrices as Record<string, unknown>)
      ?.apartHousingPrice as Record<string, unknown>[] | undefined;
    if (!list?.length) return null;
    // 가장 최신 연도 기준 중앙값
    const prices = list
      .map(i => parseInt(String(i.pblntfPc ?? '0')))
      .filter(n => n > 0);
    if (!prices.length) return null;
    prices.sort((a, b) => a - b);
    return prices[Math.floor(prices.length / 2)];
  } catch { return null; }
}

/* ── 개별주택 공시가격 파서 (vworld JSON) ────────────────── */
export function parseIndvdOfficialPriceJson(raw: unknown): number | null {
  try {
    const obj = raw as Record<string, unknown>;
    const list = (obj?.indvdHousingPrices as Record<string, unknown>)
      ?.indvdHousingPrice as Record<string, unknown>[] | undefined;
    if (!list?.length) return null;
    const prices = list
      .map(i => parseInt(String(i.pblntfPc ?? '0')))
      .filter(n => n > 0);
    if (!prices.length) return null;
    prices.sort((a, b) => a - b);
    return prices[Math.floor(prices.length / 2)];
  } catch { return null; }
}

/* ── 중개사무소 파서 (odcloud JSON) ──────────────────────── */
export function parseBrokerJson(raw: unknown): import('@/types/rent').BrokerInfo | null {
  try {
    const obj = raw as Record<string, unknown>;
    const data = obj?.data as Record<string, unknown>[] | undefined;
    if (!data?.length) return null;
    const item = data[0];
    return {
      name:         String(item['사무소명'] ?? ''),
      regNo:        String(item['등록번호'] ?? ''),
      status:       String(item['상태'] ?? item['등록상태'] ?? ''),
      officeAddress:String(item['소재지'] ?? item['사무소소재지'] ?? ''),
      agentName:    String(item['대표자명'] ?? item['중개사명'] ?? ''),
    };
  } catch { return null; }
}
