/**
 * 계약전야 위험 분석 엔진
 *
 * 방법론 근거:
 * - 주택임대차보호법 (대항력·우선변제권 요건)
 * - HUG·HF 전세보증보험 가입 기준 (전세가율 100% 이하)
 * - 법원경매 낙찰가율 통계 (아파트 85-90%, 빌라 65-75%)
 * - 선순위 채권 분석: (근저당 + 보증금) vs 경매예상낙찰가
 * - 깡통전세 판단: 경매낙찰가 - 선순위채권 < 내 보증금
 */

import { RentTransaction, RiskLevel, RentAnalysisResult, PropertyType, RiskFactor } from '@/types/rent';
import { formatWon } from './formatMoney';
import { getLawdName } from './lawdCodeMap';
import { formatYm } from './dateUtils';

/* ── 통계 유틸 ─────────────────────────── */
function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function average(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/* ── 경매 낙찰가율 (주택유형별 평균) ─── */
const AUCTION_RATE: Record<PropertyType, number> = {
  apartment: 0.87,  // 아파트: 87%
  villa:     0.70,  // 연립다세대: 70%
  officetel: 0.78,  // 오피스텔: 78%
  detached:  0.68,  // 단독다가구: 68%
};

const RISK_LEVELS: RiskLevel[] = ['gray', 'blue', 'yellow', 'red'];
function maxRisk(...levels: RiskLevel[]): RiskLevel {
  return levels.reduce((a, b) =>
    RISK_LEVELS.indexOf(b) > RISK_LEVELS.indexOf(a) ? b : a,
    'blue' as RiskLevel,
  );
}

/* ── 위험도 제목·메시지 ─────────────────── */
const RISK_TEXT: Record<RiskLevel, { title: string; message: string }> = {
  blue: {
    title: '안전 — 주변 시세와 큰 차이가 없습니다',
    message: '입력한 보증금은 주변 실거래가와 비교했을 때 과도하게 높지 않습니다. 하지만 시세 비교만으로 안전을 확정할 수 없습니다. 등기부등본, 근저당, 선순위 권리, 전입신고 가능 여부를 반드시 확인하세요.',
  },
  yellow: {
    title: '주의 — 위험 신호가 있습니다',
    message: '보증금이 주변 시세보다 높거나 전세가율이 높은 상태입니다. 집값 하락 시 보증금 일부를 돌려받지 못할 수 있습니다. 근저당, 선순위 권리, 보증보험 가입 가능 여부를 추가로 확인하세요.',
  },
  red: {
    title: '위험 — 위험 요소를 반드시 확인하세요',
    message: '보증금 회수에 심각한 위험이 있는 상황이 확인됩니다. 계약 전 법무사 또는 보증기관과 상담 없이 진행하지 마세요.',
  },
  gray: {
    title: '자료 부족 — 직접 확인이 필요합니다',
    message: '해당 지역의 최근 전월세 거래 데이터가 충분하지 않아 시세 비교가 어렵습니다. 등기부등본, 건축물대장, 보증보험 가입 가능 여부를 직접 확인해야 합니다.',
  },
};

/* ── 개별 위험 요소 분석 ─────────────────── */
function analyzeRiskFactors(params: {
  userDeposit: number;
  userMonthlyRent: number;
  housePrice: number | null;
  mortgageAmount: number | null;
  hasMortgage: boolean | null;
  hasPriorLiens: boolean | null;
  isOwnerMatch: boolean | null;
  canRegister: boolean | null;
  canGetFixedDate: boolean | null;
  canInsure: boolean | null;
  propertyType: PropertyType;
  depositRatio: number | null;
}): { factors: RiskFactor[]; level: RiskLevel; jeonseRate: number | null; auctionRiskDeposit: number | null; isKangton: boolean } {
  const factors: RiskFactor[] = [];
  const riskLevels: RiskLevel[] = [];

  const hp = params.housePrice != null ? params.housePrice * 10_000 : null;   // 원
  const mortgage = params.mortgageAmount != null ? params.mortgageAmount * 10_000 : null;
  const deposit = params.userDeposit;

  // ① 전세가율 분석 (집값이 있을 때)
  let jeonseRate: number | null = null;
  let auctionRiskDeposit: number | null = null;
  let isKangton = false;

  if (hp && deposit) {
    jeonseRate = Math.round((deposit / hp) * 100);
    const auctionPrice = hp * AUCTION_RATE[params.propertyType];

    if (mortgage !== null) {
      // 경매 시 세입자가 받을 수 있는 금액 = 낙찰가 - 선순위 근저당
      auctionRiskDeposit = auctionPrice - mortgage;
      isKangton = auctionRiskDeposit < deposit;

      if (isKangton) {
        riskLevels.push('red');
        factors.push({
          id: 'kangton',
          level: 'red',
          title: '깡통전세 위험 — 경매 시 보증금 회수 불가능할 수 있습니다',
          description: `집값(${formatWon(hp)})이 경매에 넘어가면 낙찰가는 약 ${formatWon(Math.round(auctionPrice))}로 예상됩니다. 은행이 먼저 ${formatWon(mortgage)}를 가져가면 남는 금액(${formatWon(Math.max(0, Math.round(auctionRiskDeposit)))})이 내 보증금(${formatWon(deposit)})보다 적습니다.`,
          action: '이 조건으로 계약하지 마세요. 근저당 말소 후 계약하거나 계약을 재검토하세요.',
        });
      } else if (jeonseRate >= 80) {
        riskLevels.push('red');
        factors.push({
          id: 'highRate',
          level: 'red',
          title: `전세가율 ${jeonseRate}% — 집값 대비 보증금이 매우 높습니다`,
          description: `보증금이 집값의 ${jeonseRate}%입니다. 집값이 ${100 - jeonseRate}%만 하락해도 보증금 전액 회수가 어려울 수 있습니다. 경매 낙찰가율을 감안하면 실질적 회수 가능 금액은 더 낮습니다.`,
          action: '전세보증보험 가입 가능 여부를 반드시 확인하세요. 전세가율 70% 이하 매물을 재검토하세요.',
        });
      } else if (jeonseRate >= 70) {
        riskLevels.push('yellow');
        factors.push({
          id: 'medRate',
          level: 'yellow',
          title: `전세가율 ${jeonseRate}% — 주의 수준`,
          description: `보증금이 집값의 ${jeonseRate}%입니다. 70% 이하가 안전 기준으로 권고됩니다. 집값 하락 시 보증금 일부를 돌려받지 못할 수 있습니다.`,
          action: '전세보증보험 사전 조회를 받으세요. 근저당 여부와 함께 확인하세요.',
        });
      }
    } else if (jeonseRate >= 90) {
      riskLevels.push('red');
      factors.push({
        id: 'highRate_noMortgage',
        level: 'red',
        title: `전세가율 ${jeonseRate}% — 집값 대비 보증금이 매우 높습니다`,
        description: `보증금이 집값의 ${jeonseRate}%입니다. 근저당 정보가 입력되지 않아 실제 위험은 더 클 수 있습니다.`,
        action: '등기부등본 을구에서 근저당 채권최고액을 확인하고 다시 분석하세요.',
      });
    } else if (jeonseRate >= 70) {
      riskLevels.push('yellow');
      factors.push({
        id: 'medRate_noMortgage',
        level: 'yellow',
        title: `전세가율 ${jeonseRate}% — 주의 수준`,
        description: `보증금이 집값의 ${jeonseRate}%입니다. 근저당 정보도 함께 입력하면 더 정확하게 분석할 수 있습니다.`,
        action: '근저당 채권최고액을 확인하고 (근저당 + 보증금) vs 집값을 비교하세요.',
      });
    }
  }

  // ② 시세 대비 위험 (API 데이터)
  if (params.depositRatio !== null) {
    if (params.depositRatio >= 130) {
      riskLevels.push('red');
      factors.push({
        id: 'marketRatio',
        level: 'red',
        title: `주변 시세보다 ${params.depositRatio - 100}% 높습니다`,
        description: `주변 유사 주택 전세 보증금 중앙값 대비 ${params.depositRatio}%입니다. 시세를 크게 초과한 계약은 전세사기의 위험 신호일 수 있습니다.`,
        action: '왜 이 집의 보증금이 주변보다 높은지 중개사에게 명확한 설명을 요구하세요.',
      });
    } else if (params.depositRatio >= 110) {
      riskLevels.push('yellow');
      factors.push({
        id: 'marketRatio',
        level: 'yellow',
        title: `주변 시세보다 ${params.depositRatio - 100}% 높습니다`,
        description: `주변 전세 보증금 중앙값 대비 ${params.depositRatio}%입니다. 시세보다 높은 계약은 추가 확인이 필요합니다.`,
        action: '국토부 실거래가 공개시스템에서 같은 단지·비슷한 면적의 최근 거래를 직접 확인하세요.',
      });
    }
  }

  // ③ 소유자 불일치
  if (params.isOwnerMatch === false) {
    riskLevels.push('red');
    factors.push({
      id: 'ownerMismatch',
      level: 'red',
      title: '소유자와 계약자가 다릅니다',
      description: '등기부등본의 소유자와 계약 상대방이 다른 경우, 진짜 집주인이 아닌 사람에게 보증금을 내는 셈입니다. 계약 자체가 법적으로 무효가 될 수 있습니다.',
      action: '지금 당장 계약을 중단하세요. 등기부등본과 신분증을 직접 대조하세요.',
    });
  }

  // ④ 전입신고 불가
  if (params.canRegister === false) {
    riskLevels.push('red');
    factors.push({
      id: 'noRegister',
      level: 'red',
      title: '전입신고 불가 — 대항력을 얻을 수 없습니다',
      description: '전입신고를 할 수 없으면 법적으로 이 집에 살지 않는 사람으로 취급됩니다. 집이 경매에 넘어가도 보증금을 돌려받을 권리(대항력·우선변제권)가 없어집니다.',
      action: '전입신고가 불가한 이유를 반드시 확인하세요. 주거용이 아닌 건물일 수 있습니다. 이 상태로 계약을 진행하지 마세요.',
    });
  }

  // ⑤ 선순위 권리
  if (params.hasPriorLiens === true) {
    riskLevels.push('red');
    factors.push({
      id: 'priorLiens',
      level: 'red',
      title: '선순위 권리 존재 — 경매 시 내 보증금이 밀립니다',
      description: '압류·가압류·가처분·선순위 임차인 등 나보다 먼저 권리를 가진 사람이 있습니다. 경매 시 이들이 먼저 배당받고 남은 돈에서 내 보증금을 받아야 합니다.',
      action: '잔금 전 해당 권리의 말소를 조건으로 계약하거나, 법무사와 상담 후 진행하세요.',
    });
  }

  // ⑥ 확정일자 불가
  if (params.canGetFixedDate === false) {
    riskLevels.push('yellow');
    factors.push({
      id: 'noFixedDate',
      level: 'yellow',
      title: '확정일자 불가 — 우선변제권을 얻을 수 없습니다',
      description: '확정일자가 없으면 경매 시 다른 채권자보다 배당 순위가 뒤로 밀립니다. 전입신고만으로는 대항력만 있고 우선변제권이 없어 보증금 회수가 어려울 수 있습니다.',
      action: '확정일자를 받을 수 없는 이유를 파악하세요. 불가 이유에 따라 계약 자체를 재검토해야 할 수 있습니다.',
    });
  }

  // ⑦ 보증보험 불가
  if (params.canInsure === false) {
    riskLevels.push('yellow');
    factors.push({
      id: 'noInsurance',
      level: 'yellow',
      title: '전세보증보험 가입 불가',
      description: '보증보험이 없으면 집주인이 보증금을 돌려주지 않을 때 소송 외에 방법이 없습니다. 전세가율이 높거나 근저당이 많은 경우 보험 가입이 안 될 수 있습니다.',
      action: 'HUG(1566-9009), HF, SGI서울보증에서 불가 이유를 확인하세요. 불가 이유가 해소되지 않으면 계약을 재검토하세요.',
    });
  }

  // ⑧ 근저당 있음 (일반 주의)
  if (params.hasMortgage === true && !factors.find(f => f.id === 'kangton') && !(hp && mortgage && jeonseRate !== null && jeonseRate >= 70)) {
    riskLevels.push('yellow');
    factors.push({
      id: 'hasMortgage',
      level: 'yellow',
      title: '근저당이 있습니다',
      description: '집주인이 이 집을 담보로 은행 대출을 받았습니다. 경매가 나면 은행이 내 보증금보다 먼저 돈을 가져갑니다.',
      action: '근저당 채권최고액을 등기부등본 을구에서 확인하고 (근저당 + 내 보증금)이 집값보다 낮은지 계산하세요.',
    });
  }

  const finalLevel = riskLevels.length > 0
    ? maxRisk(...riskLevels)
    : (params.depositRatio === null && !hp ? 'gray' : 'blue');

  return { factors, level: finalLevel, jeonseRate, auctionRiskDeposit, isKangton };
}

/* ── 공통 확인 항목 ──────────────────── */
function buildRequiredChecks(riskLevel: RiskLevel, jeonseRate: number | null): string[] {
  const checks = [
    '등기부등본 갑구: 소유자 이름과 신분증 이름을 직접 대조하세요.',
    '등기부등본 을구: 근저당 채권최고액을 확인하고 (근저당 + 보증금)이 집값보다 낮은지 계산하세요.',
    '전입신고 가능 여부: 주거용 건물인지, 전입신고가 가능한 주소인지 확인하세요.',
    '확정일자: 전입신고 당일 주민센터에서 무료로 받을 수 있습니다.',
    'HUG·HF·SGI에서 전세보증보험 사전 조회를 하세요.',
    '건축물대장에서 위반건축물 여부를 확인하세요 (정부24 → 건축물대장 발급).',
    '계약서 특약에 보증금 보호 관련 문구를 삽입하세요.',
  ];
  if (riskLevel === 'red' || (jeonseRate !== null && jeonseRate >= 80)) {
    checks.unshift('법무사 또는 주택도시보증공사(HUG) 상담을 받은 후 계약하세요.');
  }
  return checks;
}

const COMMON_QUESTIONS = [
  '오늘 날짜 기준 등기부등본을 직접 확인할 수 있나요?',
  '등기부등본 소유자와 지금 계약하는 분이 같은 분이 맞나요? 신분증으로 확인 가능한가요?',
  '이 집에 근저당이나 선순위 권리(압류, 가처분 등)가 있나요?',
  '전입신고와 확정일자를 입주 당일 바로 받을 수 있나요?',
  '전세보증보험(HUG·HF·SGI) 가입이 가능한 집인가요?',
  '건축물대장상 위반건축물 여부를 확인하셨나요?',
  '집주인이 추가 대출을 받지 않는다는 특약을 계약서에 넣을 수 있나요?',
];

const COMMON_SPECIAL_TERMS = [
  '임대인은 잔금일 다음 날까지 현재 등기부등본상 권리관계를 유지하며, 추가 근저당권 등 제한물권을 설정하지 않는다.',
  '임대인은 임차인의 전입신고 및 확정일자 취득에 협조한다.',
  '임대인의 귀책으로 전세보증보험 가입이 불가능한 경우, 임차인은 계약 해제를 요구하고 계약금 전액을 돌려받을 수 있다.',
  '계약 체결 후 등기부등본상 중대한 권리 변동이 확인될 경우, 임차인은 계약 해제 및 보증금 전액 반환을 요구할 수 있다.',
  '임대차 기간 중 임대인이 위 주택을 제3자에게 매도하는 경우 임차인의 동의를 받아야 하며, 임차인의 대항력은 그대로 유지된다.',
];

/* ── 메인 분석 함수 ────────────────────── */
export function buildAnalysis(params: {
  transactions: RentTransaction[];
  userDeposit: number;
  userMonthlyRent: number;
  propertyType: PropertyType;
  address: string;
  lawdCd: string;
  dealYm: string;
  searchedMonths: string[];
  // 사용자 추가 입력 (선택)
  housePrice?: number | null;
  mortgageAmount?: number | null;
  hasMortgage?: boolean | null;
  hasPriorLiens?: boolean | null;
  isOwnerMatch?: boolean | null;
  canRegister?: boolean | null;
  canGetFixedDate?: boolean | null;
  canInsure?: boolean | null;
}): RentAnalysisResult {
  const {
    transactions, userDeposit, userMonthlyRent, propertyType, address, lawdCd, dealYm, searchedMonths,
    housePrice = null, mortgageAmount = null, hasMortgage = null,
    hasPriorLiens = null, isOwnerMatch = null, canRegister = null,
    canGetFixedDate = null, canInsure = null,
  } = params;

  const jeonse = transactions.filter(t => t.monthlyRent === 0);
  const monthly = transactions.filter(t => t.monthlyRent > 0);

  const jeonseDeposits = jeonse.map(t => t.deposit);
  const allDeposits    = transactions.map(t => t.deposit);

  const medianJeonseDeposit = jeonse.length >= 3 ? median(jeonseDeposits) : null;
  const averageJeonseDeposit = jeonse.length >= 3 ? average(jeonseDeposits) : null;
  const medianAllDeposit    = transactions.length >= 3 ? median(allDeposits) : null;

  const referenceMedian = jeonse.length >= 3 ? medianJeonseDeposit : medianAllDeposit;

  let depositRatio: number | null = null;
  if (referenceMedian && referenceMedian > 0 && userDeposit > 0) {
    depositRatio = Math.round((userDeposit / referenceMedian) * 100);
  }

  // 전문가 분석
  const { factors, level: factorLevel, jeonseRate, auctionRiskDeposit, isKangton } = analyzeRiskFactors({
    userDeposit, userMonthlyRent, housePrice, mortgageAmount, hasMortgage,
    hasPriorLiens, isOwnerMatch, canRegister, canGetFixedDate, canInsure,
    propertyType, depositRatio,
  });

  // 최종 위험 수준: API 비교 + 사용자 입력 요소 중 최악
  let apiRisk: RiskLevel = 'blue';
  if (depositRatio === null) apiRisk = 'gray';
  else if (depositRatio >= 130) apiRisk = 'red';
  else if (depositRatio >= 110) apiRisk = 'yellow';

  const finalLevel = transactions.length >= 3
    ? maxRisk(factorLevel, apiRisk)
    : factorLevel === 'blue' ? 'gray' : factorLevel;

  const { title: riskTitle, message: riskMessage } = RISK_TEXT[finalLevel];

  // 분석 근거 문장
  const reasons: string[] = [];
  const areaName = getLawdName(lawdCd);

  if (transactions.length > 0) {
    reasons.push(
      `${areaName} ${propertyTypeLabel(propertyType)} 최근 ${searchedMonths.length}개월 거래 ${transactions.length}건(전세 ${jeonse.length}건·월세 ${monthly.length}건)을 분석했습니다.`,
    );
  }
  if (referenceMedian && referenceMedian > 0) {
    const basis = jeonse.length >= 3 ? `전세 거래 ${jeonse.length}건` : `전체 거래 ${transactions.length}건`;
    reasons.push(`${basis}의 보증금 중앙값은 ${formatWon(referenceMedian)}입니다.`);
  }
  if (depositRatio !== null) {
    const diff = depositRatio - 100;
    reasons.push(diff > 0
      ? `입력한 보증금은 주변 시세 중앙값보다 약 ${diff}% 높습니다.`
      : diff < 0
        ? `입력한 보증금은 주변 시세 중앙값보다 약 ${Math.abs(diff)}% 낮습니다.`
        : '입력한 보증금은 주변 시세 중앙값과 비슷한 수준입니다.',
    );
  }
  if (jeonseRate !== null) {
    reasons.push(`전세가율 ${jeonseRate}% — 보증금이 집값의 ${jeonseRate}%입니다.`);
  }
  reasons.push('이 결과는 계약 안전을 확정하는 것이 아닙니다. 추가 확인이 필요한 위험 신호를 알려드리는 것입니다.');

  return {
    status: 'success',
    propertyType, address, lawdCd, dealYm, searchedMonths,
    userDeposit, userMonthlyRent,
    medianJeonseDeposit, averageJeonseDeposit, medianAllDeposit,
    transactionCount: transactions.length,
    jeonseCount: jeonse.length,
    monthlyRentCount: monthly.length,
    depositRatio,
    jeonseRate, auctionRiskDeposit, isKangtonJeonse: isKangton,
    riskLevel: finalLevel, riskTitle, riskMessage,
    riskFactors: factors,
    reasonSummary: reasons,
    requiredChecks: buildRequiredChecks(finalLevel, jeonseRate),
    questionsToAsk: COMMON_QUESTIONS,
    contractSpecialTerms: COMMON_SPECIAL_TERMS,
  };
}

export function buildNoDataResult(params: {
  propertyType: PropertyType; address: string; lawdCd: string; dealYm: string;
  searchedMonths: string[]; userDeposit: number; userMonthlyRent: number;
}): RentAnalysisResult {
  return {
    status: 'noData', ...params,
    medianJeonseDeposit: null, averageJeonseDeposit: null, medianAllDeposit: null,
    transactionCount: 0, jeonseCount: 0, monthlyRentCount: 0, depositRatio: null,
    jeonseRate: null, auctionRiskDeposit: null, isKangtonJeonse: false,
    riskLevel: 'gray', riskTitle: RISK_TEXT.gray.title, riskMessage: RISK_TEXT.gray.message,
    riskFactors: [],
    reasonSummary: ['해당 지역과 기간의 전월세 거래 데이터가 충분하지 않습니다.'],
    requiredChecks: buildRequiredChecks('gray', null),
    questionsToAsk: COMMON_QUESTIONS,
    contractSpecialTerms: COMMON_SPECIAL_TERMS,
  };
}

function propertyTypeLabel(t: PropertyType): string {
  return { apartment:'아파트', villa:'연립다세대', officetel:'오피스텔', detached:'단독/다가구' }[t];
}
