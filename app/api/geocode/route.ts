/**
 * /api/geocode — 주소 → 법정동 코드 + PNU 변환
 *
 * 흐름:
 * 1. getCoord(type=parcel): 지번 주소 → PNU 직접 추출 (번지 입력 시)
 * 2. getCoord(type=road):   도로명 주소 → 위경도
 * 3. GetAddress:            위경도 → 법정동 코드 (dongName, bjdongCd)
 *
 * PNU(19자리) = 법정동10자리 + 지목1자리 + 본번4자리 + 부번4자리
 * 예: 1144012000 + 1 + 0342 + 0008 = 1144012000103420008
 */
import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.VWORLD_APT_KEY ?? process.env.VWORLD_INDVD_KEY ?? '';
const H   = { 'Referer': 'https://www.vworld.kr', 'Origin': 'https://www.vworld.kr' };

export interface GeocodeResult {
  lawdCd:        string;          // 5자리 시군구 코드
  bjdongCd:      string;          // 5자리 법정동 코드
  fullCode:      string;          // 10자리 법정동 코드
  pnu:           string | null;   // 19자리 PNU (번지 포함 주소 시)
  siDoName:      string;
  siGunGuName:   string;
  dongName:      string;
  parcelNo:      string | null;   // 지번 (예: 342-8)
  displayAddress: string;
}

/* ── vworld getCoord ─────────────────────────────── */
async function getCoord(
  address: string,
  type: 'road' | 'parcel' = 'road',
): Promise<{ x: string; y: string; refinedStructure?: Record<string,string> } | null> {
  const u = new URL('https://api.vworld.kr/req/address');
  u.searchParams.set('service', 'address');
  u.searchParams.set('request', 'GetCoord');
  u.searchParams.set('version', '2.0');
  u.searchParams.set('crs',     'epsg:4326');
  u.searchParams.set('address', address);
  u.searchParams.set('refine',  'true');
  u.searchParams.set('simple',  'false');
  u.searchParams.set('format',  'json');
  u.searchParams.set('type',    type);
  u.searchParams.set('key',     KEY);
  try {
    const res  = await fetch(u.toString(), { headers: H, next: { revalidate: 86400 } });
    const data = await res.json() as Record<string,unknown>;
    const resp = data.response as Record<string,unknown>;
    if (resp?.status !== 'OK') return null;
    const point = (resp.result as Record<string,unknown>)?.point as Record<string,string>;
    const refined = (resp.refined as Record<string,unknown>)?.structure as Record<string,string>;
    return point ? { x: point.x, y: point.y, refinedStructure: refined } : null;
  } catch { return null; }
}

/* ── vworld GetAddress (역지오코딩) ─────────────── */
async function reverseGeocode(x: string, y: string): Promise<{
  fullCode: string; dongName: string;
} | null> {
  const u = new URL('https://api.vworld.kr/req/address');
  u.searchParams.set('service',  'address');
  u.searchParams.set('request',  'GetAddress');
  u.searchParams.set('version',  '2.0');
  u.searchParams.set('crs',      'epsg:4326');
  u.searchParams.set('point',    `${x},${y}`);
  u.searchParams.set('format',   'json');
  u.searchParams.set('type',     'both');
  u.searchParams.set('key',      KEY);
  try {
    const res  = await fetch(u.toString(), { headers: H, next: { revalidate: 86400 } });
    const data = await res.json() as Record<string,unknown>;
    const resp = data.response as Record<string,unknown>;
    if (resp?.status !== 'OK') return null;
    const results = resp.result as Record<string,unknown>[];
    const item = results?.find(r => r.type === 'parcel') ?? results?.[0];
    if (!item) return null;
    const st = item.structure as Record<string,string>;
    return { fullCode: st.level4LC, dongName: st.level4L ?? st.level4A ?? '' };
  } catch { return null; }
}

/* ── PNU 추출 ─────────────────────────────────────── */
function extractPnu(levelCode: string): string | null {
  if (!levelCode) return null;
  const cleaned = levelCode.replace(/\s/g, '');
  // 19자리면 바로 PNU
  if (cleaned.length === 19) return cleaned;
  // 법정동코드(10) + 지목(1) 이상이면 PNU 구성 시도
  if (cleaned.length >= 10) return cleaned.padEnd(19, '0').slice(0, 19);
  return null;
}

/* ── 메인 핸들러 ──────────────────────────────────── */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: '주소를 입력해주세요.' }, { status: 400 });
  }
  if (!KEY) {
    return NextResponse.json({ error: 'vworld API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  // 1. 지번 주소 시도 (번지 포함 시 PNU 직접 추출)
  let coord = await getCoord(address, 'parcel');
  let pnu: string | null = null;
  let parcelNo: string | null = null;

  if (coord?.refinedStructure) {
    const st = coord.refinedStructure;
    parcelNo = st.level5 || null;
    // 사용자 입력 주소에 번지가 포함됐을 때만 PNU 유효
    // ("1" 같은 기본 필지 번호는 제외 — 동 이름만 입력 시 vworld가 첫 필지를 반환)
    const hasParcelInInput = /\d{2,}/.test(address); // 입력에 2자리 이상 숫자 포함 여부
    if (parcelNo && parcelNo !== '0' && hasParcelInInput) {
      pnu = extractPnu(st.level4LC);
    }
  }

  // 2. 지번 실패 시 도로명으로 재시도
  if (!coord) {
    coord = await getCoord(address, 'road');
  }
  if (!coord) {
    return NextResponse.json({ error: '주소를 찾을 수 없습니다. 더 자세한 주소를 입력해주세요.' }, { status: 404 });
  }

  // 3. 역지오코딩으로 법정동 코드 확보
  const rev = await reverseGeocode(coord.x, coord.y);
  if (!rev?.fullCode || rev.fullCode.length < 10) {
    return NextResponse.json({ error: '법정동 코드를 가져오지 못했습니다.' }, { status: 500 });
  }

  const { fullCode, dongName } = rev;
  const lawdCd   = fullCode.slice(0, 5);
  const bjdongCd = fullCode.slice(5, 10);

  const result: GeocodeResult = {
    lawdCd, bjdongCd, fullCode, pnu, parcelNo,
    siDoName:    rev.fullCode.startsWith('11') ? '서울특별시'
               : rev.fullCode.startsWith('26') ? '부산광역시'
               : rev.fullCode.startsWith('41') ? '경기도' : '',
    siGunGuName: dongName.includes('구') ? dongName.split(' ').find(w => w.endsWith('구')) ?? '' : '',
    dongName,
    displayAddress: `${dongName}${parcelNo ? ' ' + parcelNo : ''}`,
  };

  return NextResponse.json(result);
}
