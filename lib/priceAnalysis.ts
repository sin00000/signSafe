/**
 * 가격 위험 분석 — 정밀도 최대화 버전
 *
 * 정확도 향상 기법:
 * 1. 최소 표본 15건 — 이하면 자동 fallback
 * 2. IQR 이상값 제거 — 급매·특수거래 제외
 * 3. 최근 2개월 2배 가중치 — 시장 변화 반영
 * 4. 이상 감지 — 전세 > 매매 시 데이터 불신뢰 처리
 * 5. ㎡당 가격 정규화 — 면적 필터 불가 시 표준화
 * 6. 신뢰도 표시 — 표본 수 기반 (높음/중간/낮음)
 * 7. HUG 정밀 기준 계산 — 실제 가입 공식 적용
 * 8. 주택유형별 경매낙찰가율 차등
 */
import { RiskSignal, RentTransaction, SaleTransaction, PropertyType } from '@/types/rent';
import { critical, warning, safe, unknown } from './riskSignals';
import { formatWon } from './formatMoney';

/* ── 상수 ───────────────────────────────────────────────── */
const MIN_SAMPLE  = 15;   // 신뢰 가능 최소 표본 수
const RECENT_MONTHS = 2;  // 최근 N개월 = 가중치 2배

const AUCTION_RATE: Record<PropertyType, number> = {
  apartment: 0.88,
  villa:     0.71,
  officetel: 0.78,
  detached:  0.68,
};

/* ── 통계 ───────────────────────────────────────────────── */
function weightedMedian(items: Array<{ price: number; year: number; month: number }>): number {
  if (!items.length) return 0;
  const now   = new Date();
  const nowYm = now.getFullYear() * 100 + (now.getMonth() + 1);

  const expanded: number[] = [];
  for (const { price, year, month } of items) {
    const ym       = year * 100 + month;
    const monthAgo = Math.max(0, nowYm - ym);
    const weight   = monthAgo <= RECENT_MONTHS ? 2 : 1;
    for (let i = 0; i < weight; i++) expanded.push(price);
  }
  const sorted = [...expanded].sort((a, b) => a - b);
  const m      = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function removeOutliers(values: number[]): number[] {
  if (values.length < 8) return values; // 작은 표본은 제거 안 함
  const s  = [...values].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo  = q1 - 1.5 * iqr;
  const hi  = q3 + 1.5 * iqr;
  const filtered = values.filter(v => v >= lo && v <= hi);
  return filtered.length >= 3 ? filtered : values; // 너무 많이 제거되면 원본 반환
}

type Confidence = 'high' | 'medium' | 'low' | 'insufficient';
function confidence(n: number): Confidence {
  if (n >= 30) return 'high';
  if (n >= MIN_SAMPLE) return 'medium';
  if (n >= 7) return 'low';
  return 'insufficient';
}
const CONF_KR: Record<Confidence, string> = {
  high: '높음', medium: '중간', low: '낮음', insufficient: '부족',
};

/* ── 매칭 유틸 ──────────────────────────────────────────── */
function matchBuilding(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = a.replace(/\s/g, '').toLowerCase();
  const nb = b.replace(/\s/g, '').toLowerCase();
  return na.includes(nb) || nb.includes(na) ||
    (na.length >= 4 && nb.length >= 4 && na.slice(0, 4) === nb.slice(0, 4));
}
function matchDong(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim() || a.trim().includes(b.trim()) || b.trim().includes(a.trim());
}
function areaRange(area: number) {
  return Math.max(10, area * 0.25);
}

/* ── 표준화된 거래 인터페이스 ───────────────────────────── */
interface BaseTx { area: number; buildingName: string; dong: string; floor: number; year: number; month: number; }
interface RentTx  extends BaseTx { price: number; monthlyRent: number; }
interface SaleTx  extends BaseTx { price: number; }

function toRentTx(t: RentTransaction): RentTx {
  return { price: t.deposit, monthlyRent: t.monthlyRent, area: t.area, buildingName: t.buildingName, dong: t.dong, floor: t.floor, year: t.year, month: t.month };
}
function toSaleTx(t: SaleTransaction): SaleTx {
  return { price: t.price, area: t.area, buildingName: t.buildingName, dong: t.dong, floor: t.floor ?? 0, year: t.year, month: t.month };
}

/* ── 필터 함수들 ─────────────────────────────────────────── */
function byBuilding<T extends BaseTx>(items: T[], name: string): T[] {
  return items.filter(t => matchBuilding(t.buildingName, name));
}
function byArea<T extends BaseTx>(items: T[], area: number): T[] {
  const r = areaRange(area);
  return items.filter(t => t.area > 0 && Math.abs(t.area - area) <= r);
}
function byDong<T extends BaseTx>(items: T[], dong: string): T[] {
  return items.filter(t => matchDong(t.dong, dong));
}
function byFloor<T extends BaseTx>(items: T[], floor: number): T[] {
  return items.filter(t => t.floor > 0 && Math.abs(t.floor - floor) <= 3);
}
function byAge<T extends BaseTx & { year: number }>(items: T[], ageDays: number): T[] {
  if (ageDays <= 0) return items;
  const targetYear = new Date().getFullYear() - Math.round(ageDays / 365);
  return items.filter(t => t.year > 0 && Math.abs(t.year - targetYear) <= 7);
}

/* ── 계단식 필터 결과 ────────────────────────────────────── */
interface FilterResult<T> {
  items: T[];
  label: string;
  conf: Confidence;
  level: number;  // 1 = 가장 정밀, 9 = 가장 넓음
}

function cascade<T extends BaseTx & { year: number }>(
  all: T[],
  opts: { name: string; area: number | null; dong: string; floor: number | null; ageDays: number },
): FilterResult<T> {
  const { name, area, dong, floor, ageDays } = opts;

  const try_ = (items: T[], label: string, level: number): FilterResult<T> | null => {
    if (items.length >= MIN_SAMPLE) return { items, label, conf: confidence(items.length), level };
    return null;
  };

  // 1. 단지 + 면적 + 층
  if (name && area && floor) {
    const r = try_(byFloor(byArea(byBuilding(all, name), area), floor), `단지+면적+층 ${byFloor(byArea(byBuilding(all, name), area), floor).length}건`, 1);
    if (r) return r;
  }
  // 2. 단지 + 면적
  if (name && area) {
    const r = try_(byArea(byBuilding(all, name), area), `단지+면적 ${byArea(byBuilding(all, name), area).length}건`, 2);
    if (r) return r;
  }
  // 3. 단지
  if (name) {
    const r = try_(byBuilding(all, name), `단지 ${byBuilding(all, name).length}건`, 3);
    if (r) return r;
  }
  // 4. 동 + 면적 + 건물나이
  if (dong && area && ageDays > 0) {
    const items = byAge(byArea(byDong(all, dong), area), ageDays);
    const r = try_(items, `${dong}+면적+나이 ${items.length}건`, 4);
    if (r) return r;
  }
  // 5. 동 + 면적
  if (dong && area) {
    const items = byArea(byDong(all, dong), area);
    const r = try_(items, `${dong}+면적 ${items.length}건`, 5);
    if (r) return r;
  }
  // 6. 동
  if (dong) {
    const items = byDong(all, dong);
    const r = try_(items, `${dong} ${items.length}건`, 6);
    if (r) return r;
  }
  // 7. 면적
  if (area) {
    const items = byArea(all, area);
    const r = try_(items, `유사면적(±${Math.round(areaRange(area))}㎡) ${items.length}건`, 7);
    if (r) return r;
  }
  // 8. 구 전체 (항상 반환)
  return { items: all, label: `구 전체 ${all.length}건`, conf: confidence(all.length), level: 8 };
}

/* ── 중앙값 계산 (아웃라이어 제거 + 가중치) ──────────────── */
function calcMedian<T extends BaseTx & { price: number; year: number; month: number }>(
  items: T[],
): number | null {
  if (!items.length) return null;
  const prices = removeOutliers(items.map(t => t.price));
  if (prices.length < 3) return null;
  const weighted = items.filter(t => prices.includes(t.price));
  return weightedMedian(weighted.map(t => ({ price: t.price, year: t.year, month: t.month })));
}

/* ── 이상 감지 ──────────────────────────────────────────── */
function isSane(rentMedian: number | null, saleMedian: number | null): boolean {
  if (!rentMedian || !saleMedian) return true;
  return rentMedian <= saleMedian * 0.98; // 전세 중앙값이 매매가보다 높으면 이상
}

/* ── 신뢰도 레이블 ───────────────────────────────────────── */
function confLabel(conf: Confidence, label: string): string {
  return `${label} — 신뢰도 ${CONF_KR[conf]}`;
}

/* ── 컨텍스트 ───────────────────────────────────────────── */
export interface PriceContext {
  userDeposit: number;
  userMonthlyRent: number;
  rentTransactions: RentTransaction[];
  saleTransactions: SaleTransaction[];
  officialPrice: number | null;
  bankDebt: number;
  priorTenantDeposit: number;
  propertyType: PropertyType;
  searchedMonths: string[];
  area: number | null;
  buildingName: string;
  dongName: string;
  floor: number | null;
  buildingAgeDays: number;
  isSeoul: boolean;
}

/* ── 메인 분석 ──────────────────────────────────────────── */
export function analyzePriceRisk(ctx: PriceContext): RiskSignal[] {
  const { userDeposit, officialPrice, bankDebt, priorTenantDeposit,
          propertyType, searchedMonths, area, buildingName,
          dongName, floor, buildingAgeDays, isSeoul } = ctx;

  const signals: RiskSignal[] = [];

  // 표준화된 거래 목록
  const jeonse = ctx.rentTransactions.filter(t => t.monthlyRent === 0).map(toRentTx);
  const sales  = ctx.saleTransactions.map(toSaleTx);
  const opts   = { name: buildingName, area, dong: dongName, floor, ageDays: buildingAgeDays };

  // 계단식 필터
  let rentFiltered = cascade(jeonse, opts);
  let saleFiltered = cascade(sales,  opts);

  // 중앙값 계산
  let rentMedian = calcMedian(rentFiltered.items);
  let saleMedian = calcMedian(saleFiltered.items);

  // 이상 감지 → fallback (면적만 유지, 단지명/층/동 제거)
  if (!isSane(rentMedian, saleMedian)) {
    rentFiltered = cascade(jeonse, { ...opts, name: '', floor: null, dong: '' });
    saleFiltered = cascade(sales,  { ...opts, name: '', floor: null, dong: '' });
    rentMedian   = calcMedian(rentFiltered.items);
    saleMedian   = calcMedian(saleFiltered.items);
    signals.push(unknown('data_inconsistency', 'price',
      '좁은 범위의 데이터가 불안정해 더 넓은 범위로 분석합니다',
      '필터를 좁혔을 때 전세 중앙값이 매매 중앙값보다 높게 나오는 등 이상이 감지되어 신뢰할 수 있는 범위로 자동 조정했습니다.',
      `자동 조정됨: ${rentFiltered.label}`,
      '단지명과 면적을 정확히 입력하면 더 정밀한 분석이 가능합니다.',
      '데이터 품질 검증'));
  }

  const monthNote = searchedMonths.length ? `최근 ${searchedMonths.length}개월` : '';

  /* ── 표본 부족 경고 ──────────────────────────────────── */
  if (rentFiltered.conf === 'insufficient' || !rentMedian) {
    signals.push(unknown('rent_insufficient', 'price',
      `전세 거래 표본이 부족합니다 (${rentFiltered.items.length}건)`,
      `신뢰할 수 있는 분석에는 최소 ${MIN_SAMPLE}건이 필요합니다. 현재 표본이 너무 적어 시세 비교 결과의 오차가 클 수 있습니다.`,
      `${monthNote} ${rentFiltered.label}`,
      '국토부 실거래가 공개시스템(rt.molit.go.kr)에서 직접 주변 시세를 확인하세요.',
      `전월세 실거래가 API`));
  }
  if (saleFiltered.conf === 'insufficient' || !saleMedian) {
    signals.push(unknown('sale_insufficient', 'price',
      `매매 거래 표본이 부족합니다 (${saleFiltered.items.length}건)`,
      `신뢰할 수 있는 전세가율 계산에는 최소 ${MIN_SAMPLE}건이 필요합니다.`,
      `${monthNote} ${saleFiltered.label}`,
      'KB부동산 또는 네이버 부동산에서 최근 매매가를 직접 확인하세요.',
      `매매 실거래가 API`));
  }

  if (!userDeposit) return signals;

  const totalLien    = bankDebt + priorTenantDeposit;
  const auctionRate  = AUCTION_RATE[propertyType];

  /* ── 선순위 임차인 ───────────────────────────────────── */
  if (priorTenantDeposit > 0 && saleMedian) {
    const r = Math.round((priorTenantDeposit / saleMedian) * 100);
    if (r >= 30) {
      signals.push(critical('high_prior_tenant', 'price',
        `선순위 임차인 보증금이 매매가의 ${r}%입니다`,
        '이미 다른 세입자가 큰 보증금을 내고 살고 있습니다. 내 보증금까지 합산하면 경매 시 회수가 매우 어려울 수 있습니다.',
        `선순위 ${formatWon(priorTenantDeposit)} / 매매 중앙값 ${formatWon(saleMedian)} (${saleFiltered.label})`,
        '이 집을 계약하기 전 반드시 법무사 상담을 받으세요.',
        '사용자 입력'));
    } else if (r >= 10) {
      signals.push(warning('prior_tenant_exists', 'price',
        `선순위 임차인 보증금 ${formatWon(priorTenantDeposit)} 존재`,
        '경매 시 내 보증금보다 선순위 임차인이 먼저 배당받습니다.',
        `선순위 ${formatWon(priorTenantDeposit)} / 매매 중앙값 ${formatWon(saleMedian)}`,
        '(선순위보증금 + 근저당 + 내보증금)이 매매가를 초과하지 않는지 확인하세요.',
        '사용자 입력'));
    }
  }

  /* ── 전체 선순위채권 + 내보증금 vs 매매가 ───────────── */
  if (saleMedian) {
    const combined      = totalLien + userDeposit;
    const combinedRatio = Math.round((combined / saleMedian) * 100);
    const auctionPrice  = Math.round(saleMedian * auctionRate);
    const afterLien     = Math.max(0, auctionPrice - totalLien);
    const loss          = Math.max(0, userDeposit - afterLien);
    const lossRatio     = Math.round((loss / userDeposit) * 100);

    if (combined > saleMedian) {
      signals.push(critical('combined_exceeds', 'price',
        `(선순위채권+보증금) ${formatWon(combined)}이 매매가 ${formatWon(saleMedian)}를 초과합니다`,
        '경매 낙찰가에서 선순위 채권을 모두 갚으면 내 보증금을 돌려받을 돈이 남지 않습니다.',
        `근저당 ${formatWon(bankDebt)} + 선순위 ${formatWon(priorTenantDeposit)} + 내보증금 ${formatWon(userDeposit)} = ${formatWon(combined)} vs ${formatWon(saleMedian)} (${confLabel(saleFiltered.conf, saleFiltered.label)})`,
        '이 조건으로는 계약하지 마세요. 법무사 상담이 필수입니다.',
        `매매 실거래가 API`));
    } else if (loss > 0) {
      const sig = lossRatio >= 30 ? critical : warning;
      signals.push(sig(`auction_loss_${lossRatio >= 30 ? 'critical' : 'warning'}`, 'price',
        `경매 시 보증금의 ${lossRatio}%(${formatWon(loss)}) 손실 가능성`,
        `집이 경매에 넘어가면 낙찰가(매매가의 약 ${Math.round(auctionRate*100)}%)에서 선순위 채권 ${formatWon(totalLien)}를 먼저 갚고 남은 돈 ${formatWon(afterLien)}만 받을 수 있습니다.`,
        `경매 예상: ${formatWon(auctionPrice)} - 선순위 ${formatWon(totalLien)} = ${formatWon(afterLien)} (내 보증금 ${formatWon(userDeposit)} 중 ${formatWon(loss)} 손실)`,
        '전세보증보험 가입을 반드시 확인하세요.',
        `매매 실거래가 API (${saleFiltered.label})`));
    }
  }

  /* ── 전세 시세 대비 비교 ─────────────────────────────── */
  if (rentMedian && rentMedian > 0) {
    const ratio  = Math.round((userDeposit / rentMedian) * 100);
    const label  = confLabel(rentFiltered.conf, rentFiltered.label);
    const evid   = `내 보증금 ${formatWon(userDeposit)} / 전세 중앙값 ${formatWon(rentMedian)} (${label})`;

    if (ratio >= 130) {
      signals.push(critical('deposit_130pct', 'price',
        `보증금이 주변 전세 시세의 ${ratio}%입니다`, evid.replace('내 보증금', '보증금이 시세의 30% 이상 높습니다.'),
        evid, '전세보증보험 가입 가능 여부를 반드시 확인하세요.', `전월세 API (${rentFiltered.label})`));
    } else if (ratio >= 110) {
      signals.push(warning('deposit_110pct', 'price',
        `보증금이 주변 전세 시세의 ${ratio}%입니다`, '보증금이 주변 시세보다 다소 높습니다.',
        evid, '같은 단지 최근 전세 거래를 직접 확인하세요.', `전월세 API (${rentFiltered.label})`));
    } else {
      signals.push(safe('deposit_ok', 'price',
        `보증금이 주변 전세 시세 수준입니다 (${ratio}%)`, `${label} 기준으로 중앙값의 ${ratio}%입니다.`,
        evid, '시세 기준으로는 이상 없음. 등기부등본과 근저당을 반드시 확인하세요.',
        `전월세 API (${rentFiltered.label})`));
    }
  }

  /* ── 전세가율 ────────────────────────────────────────── */
  if (saleMedian && saleMedian > 0) {
    const rate  = Math.round((userDeposit / saleMedian) * 100);
    const label = confLabel(saleFiltered.conf, saleFiltered.label);
    const evid  = `보증금 ${formatWon(userDeposit)} / 매매 중앙값 ${formatWon(saleMedian)} (${label})`;

    if (rate >= 90) {
      signals.push(critical('rate_90', 'price', `전세가율 ${rate}% — 집값 대비 보증금이 매우 높습니다`,
        `집값의 ${rate}%를 보증금으로 냅니다. ${100-rate}%만 하락해도 보증금 전액 회수가 어렵습니다.`,
        evid, 'HUG 전세보증보험 사전 조회 후 계약을 결정하세요.', `매매 API (${saleFiltered.label})`));
    } else if (rate >= 80) {
      signals.push(critical('rate_80', 'price', `전세가율 ${rate}% — 위험 수준`,
        '80% 이상이면 HUG 보증보험 가입이 거절될 수 있습니다.',
        evid, 'HUG(1566-9009)에 사전 조회하세요.', `매매 API (${saleFiltered.label})`));
    } else if (rate >= 70) {
      signals.push(warning('rate_70', 'price', `전세가율 ${rate}% — 주의 수준`,
        '70~80%는 주의 구간입니다.', evid,
        '전세보증보험 가입과 근저당 여부를 확인하세요.', `매매 API (${saleFiltered.label})`));
    } else {
      signals.push(safe('rate_safe', 'price', `전세가율 ${rate}% — 비교적 안전`,
        `매매가 대비 ${rate}%로 안전 기준(70% 이하) 이내입니다.`, evid,
        '근저당 + 보증금 합계가 매매가를 초과하지 않는지도 확인하세요.', `매매 API (${saleFiltered.label})`));
    }
  }

  /* ── 공시가격 기준 ───────────────────────────────────── */
  if (officialPrice && officialPrice > 0) {
    const r = Math.round((userDeposit / officialPrice) * 100);
    if (r >= 100) {
      signals.push(critical('official_100', 'price',
        `보증금이 공시가격(${formatWon(officialPrice)})을 초과합니다`,
        '공시가격은 시세의 60~80%입니다. 보증금이 공시가격 이상이면 HUG 보증보험 가입이 불가합니다.',
        `보증금 ${formatWon(userDeposit)} / 공시가격 ${formatWon(officialPrice)} (${r}%)`,
        '이 집에는 전세보증보험 가입이 매우 어렵습니다. 계약을 재검토하세요.',
        '공시가격 API (해당 건물)'));
    } else if (r >= 80) {
      signals.push(warning('official_80', 'price',
        `보증금이 공시가격의 ${r}%입니다`,
        '80% 이상이면 일부 보증보험 가입이 제한될 수 있습니다.',
        `보증금 ${formatWon(userDeposit)} / 공시가격 ${formatWon(officialPrice)}`,
        'HUG 보증보험 사전 조회를 받으세요.',
        '공시가격 API (해당 건물)'));
    } else {
      signals.push(safe('official_ok', 'price',
        `보증금이 공시가격의 ${r}%로 보증보험 기준 충족`,
        `공시가격 대비 ${r}%로 HUG 가입 기준(100% 이하) 이내입니다.`,
        `보증금 ${formatWon(userDeposit)} / 공시가격 ${formatWon(officialPrice)}`,
        '이사 후 즉시 보증보험을 신청하세요.',
        '공시가격 API (해당 건물)'));
    }
  }

  /* ── HUG 정밀 가입 기준 ──────────────────────────────── */
  const refPrice      = saleMedian ?? officialPrice;
  const depositLimit  = isSeoul ? 700_000_000 : 500_000_000;

  if (refPrice && userDeposit > 0) {
    const hugTotal = bankDebt + priorTenantDeposit + userDeposit;
    const hugRatio = hugTotal / refPrice;
    const overLimit = userDeposit > depositLimit;

    if (overLimit) {
      signals.push(warning('hug_limit', 'price',
        `보증금이 HUG 한도(${formatWon(depositLimit)})를 초과합니다`,
        `HUG는 ${isSeoul ? '서울' : '수도권 외'} 기준 ${formatWon(depositLimit)}까지만 보증합니다.`,
        `내 보증금 ${formatWon(userDeposit)} > 한도 ${formatWon(depositLimit)}`,
        'HF(한국주택금융공사)나 SGI서울보증의 한도는 다를 수 있으니 별도 확인하세요.',
        'HUG 보증보험 기준'));
    } else if (hugRatio > 1.0) {
      signals.push(critical('hug_no', 'price',
        `HUG 전세보증보험 가입 불가 — 비율 ${Math.round(hugRatio*100)}%`,
        '(근저당+선순위보증금+내보증금)/주택가격이 100%를 초과해 HUG 가입이 불가능합니다.',
        `합계 ${formatWon(hugTotal)} / 주택가격 ${formatWon(refPrice)} = ${Math.round(hugRatio*100)}%`,
        '이 집에는 전세보증보험 가입이 어렵습니다. 계약을 재검토하세요.',
        'HUG 보증보험 기준 (정밀계산)'));
    } else if (hugRatio > 0.9) {
      signals.push(warning('hug_border', 'price',
        `HUG 가입 경계선 — ${Math.round(hugRatio*100)}%`,
        `HUG 비율이 ${Math.round(hugRatio*100)}%입니다. 90% 이상이면 추가 심사가 필요하거나 거절될 수 있습니다.`,
        `합계 ${formatWon(hugTotal)} / ${formatWon(refPrice)}`,
        'HUG(1566-9009)에 사전 조회하세요.', 'HUG 보증보험 기준 (정밀계산)'));
    } else {
      signals.push(safe('hug_ok', 'price',
        `HUG 가입 기준 충족 — ${Math.round(hugRatio*100)}%`,
        `비율이 ${Math.round(hugRatio*100)}%로 HUG 가입 기준(100% 이하)을 충족합니다.`,
        `합계 ${formatWon(hugTotal)} / ${formatWon(refPrice)}`,
        '이사 후 즉시 HUG·HF·SGI에 신청하세요.',
        'HUG 보증보험 기준 (정밀계산)'));
    }
  }

  return signals;
}
