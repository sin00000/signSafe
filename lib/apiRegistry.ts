import { ApiDefinition, PropertyType, ApiCallParams } from '@/types/rent';

const DK = () => process.env.DATA_GO_KR_API_KEY ?? '';
const VI = () => process.env.VWORLD_INDVD_KEY ?? '';
const VA = () => process.env.VWORLD_APT_KEY ?? '';

/* ── 실거래가 공통 URL 빌더 ────────────────────────────────── */
function molit(path: string, p: ApiCallParams): string | null {
  if (!p.lawdCd || !p.dealYm) return null;
  const u = new URL(`https://apis.data.go.kr/1613000/${path}`);
  u.searchParams.set('serviceKey', DK());
  u.searchParams.set('LAWD_CD',   p.lawdCd);
  u.searchParams.set('DEAL_YMD',  p.dealYm);
  u.searchParams.set('numOfRows', '1000');
  u.searchParams.set('pageNo',    '1');
  return u.toString();
}

/* ════════════════════════════════════════════════════════════
   API 레지스트리 — 새 API를 추가하려면 이 배열에 객체만 추가한다
═══════════════════════════════════════════════════════════ */
export const API_REGISTRY: ApiDefinition[] = [

  // ── 전월세 실거래가 4종 ──────────────────────────────────
  {
    id: 'rent_apartment',
    name: '아파트 전월세 실거래가',
    category: 'rentPrice',
    propertyTypes: ['apartment'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcAptRent/getRTMSDataSvcAptRent', p),
    responseType: 'xml',
    enabled: true,
  },
  {
    id: 'rent_villa',
    name: '연립다세대 전월세 실거래가',
    category: 'rentPrice',
    propertyTypes: ['villa'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcRHRent/getRTMSDataSvcRHRent', p),
    responseType: 'xml',
    enabled: true,
  },
  {
    id: 'rent_officetel',
    name: '오피스텔 전월세 실거래가',
    category: 'rentPrice',
    propertyTypes: ['officetel'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent', p),
    responseType: 'xml',
    enabled: true,
  },
  {
    id: 'rent_detached',
    name: '단독/다가구 전월세 실거래가',
    category: 'rentPrice',
    propertyTypes: ['detached'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcSHRent/getRTMSDataSvcSHRent', p),
    responseType: 'xml',
    enabled: true,
  },

  // ── 매매 실거래가 4종 ──────────────────────────────────
  {
    id: 'sale_apartment',
    name: '아파트 매매 실거래가',
    category: 'salePrice',
    propertyTypes: ['apartment'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade', p),
    responseType: 'xml',
    enabled: true,
  },
  {
    id: 'sale_villa',
    name: '연립다세대 매매 실거래가',
    category: 'salePrice',
    propertyTypes: ['villa'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade', p),
    responseType: 'xml',
    enabled: true,
  },
  {
    id: 'sale_officetel',
    name: '오피스텔 매매 실거래가',
    category: 'salePrice',
    propertyTypes: ['officetel'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade', p),
    responseType: 'xml',
    enabled: true,
  },
  {
    id: 'sale_detached',
    name: '단독/다가구 매매 실거래가',
    category: 'salePrice',
    propertyTypes: ['detached'],
    requiredParams: ['lawdCd', 'dealYm'],
    buildUrl: p => molit('RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade', p),
    responseType: 'xml',
    enabled: true,
  },

  // ── 공시가격 ─────────────────────────────────────────────
  {
    id: 'price_apartment_official',
    name: '공동주택 공시가격',
    category: 'officialPrice',
    propertyTypes: ['apartment', 'villa', 'officetel'],
    requiredParams: ['lawdCd'],
    // key: D3A9D9DC-3C0A-3FB7-8F21-90ECB43C88A1
    // Referer 헤더 필수 / pnu(19자리) 필수
    buildUrl: p => {
      if (!p.pnu) return null;
      const u = new URL('https://api.vworld.kr/ned/data/getApartHousingPriceAttr');
      u.searchParams.set('key',      VA());
      u.searchParams.set('format',   'json');
      u.searchParams.set('pnu',      p.pnu);
      u.searchParams.set('stdrYear', new Date().getFullYear().toString());
      u.searchParams.set('numOfRows','10');
      u.searchParams.set('pageNo',   '1');
      return u.toString();
    },
    responseType: 'json',
    enabled: true,
  },
  {
    id: 'price_individual_official',
    name: '개별주택 공시가격',
    category: 'officialPrice',
    propertyTypes: ['detached'],
    requiredParams: ['lawdCd'],
    // key: CEF37C50-5A11-3D52-8F79-864C1C74B79D
    buildUrl: p => {
      if (!p.pnu) return null;
      const u = new URL('https://api.vworld.kr/ned/data/getIndvdHousingPriceAttr');
      u.searchParams.set('key',      VI());
      u.searchParams.set('format',   'json');
      u.searchParams.set('pnu',      p.pnu);
      u.searchParams.set('stdrYear', new Date().getFullYear().toString());
      u.searchParams.set('numOfRows','10');
      u.searchParams.set('pageNo',   '1');
      return u.toString();
    },
    responseType: 'json',
    enabled: true,
  },

  // ── 건축물대장 ──────────────────────────────────────────
  {
    id: 'building_registry',
    name: '건축물대장 (표제부)',
    category: 'building',
    propertyTypes: 'all',
    requiredParams: ['sigunguCd', 'bjdongCd'],
    buildUrl: p => {
      if (!p.sigunguCd || !p.bjdongCd) return null;
      const u = new URL('https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo');
      u.searchParams.set('serviceKey', DK());
      u.searchParams.set('sigunguCd',  p.sigunguCd);
      u.searchParams.set('bjdongCd',   p.bjdongCd);
      u.searchParams.set('numOfRows',  '10');
      u.searchParams.set('pageNo',     '1');
      return u.toString();
    },
    responseType: 'xml',
    enabled: true,
  },

  // ── 중개사 관련 ─────────────────────────────────────────
  {
    id: 'broker_stats',
    name: '중개사무소 등록현황 (시군구별 통계)',
    category: 'broker',
    propertyTypes: 'all',
    // 개별 사무소 조회 API가 아니라 시군구별 통계 API
    // 필드: 시도명, 시군구명, 공인중개사(개수), 법인, 계, 분사무소
    // 개별 사무소 확인은 건공협(www.kar.or.kr) 또는 국토부 링크 제공
    requiredParams: [],
    buildUrl: p => {
      const u = new URL(
        'https://api.odcloud.kr/api/15063946/v1/uddi:2e16a57b-9ad4-4798-9ad1-f0cd53280f0c'
      );
      u.searchParams.set('serviceKey', DK());
      u.searchParams.set('perPage', '260');  // 전국 모든 시군구
      u.searchParams.set('page', '1');
      return u.toString();
    },
    responseType: 'json',
    enabled: true,
  },
  // broker_agent 제거: 개별 검증이 아닌 통계 성격 → UI 안내 카드로 대체
];

/* ── 헬퍼 ────────────────────────────────────────────────── */
export function getApisForCategory(category: string): ApiDefinition[] {
  return API_REGISTRY.filter(a => a.enabled && a.category === category);
}

export function getApisForPropertyType(
  propertyType: PropertyType,
  category?: string,
): ApiDefinition[] {
  return API_REGISTRY.filter(a => {
    if (!a.enabled) return false;
    if (category && a.category !== category) return false;
    return a.propertyTypes === 'all' || a.propertyTypes.includes(propertyType);
  });
}
