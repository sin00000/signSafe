import { RiskSignal, RiskDecision, TrafficLight } from '@/types/rent';

const TRAFFIC_COPY: Record<TrafficLight, { headline: string; summary: string }> = {
  red: {
    headline: '계약 전 반드시 재검토가 필요합니다.',
    summary:
      '현재 확인 가능한 정보 기준으로 심각한 위험 신호가 발견되었습니다. 전문가(법무사 또는 HUG)와 상담 없이 계약을 진행하지 마세요.',
  },
  yellow: {
    headline: '계약은 가능하지만 추가 확인이 필요합니다.',
    summary:
      '주의가 필요한 항목이 있습니다. 아래 항목들을 확인한 뒤 계약을 진행하세요.',
  },
  green: {
    headline: '현재 확인 가능한 정보 기준으로 큰 위험 신호는 없습니다.',
    summary:
      '현재 입력된 정보와 조회된 데이터 기준으로는 주요 위험 신호가 발견되지 않았습니다. ' +
      '단, 등기부등본과 계약서는 반드시 직접 확인하세요.',
  },
  gray: {
    headline: '판단에 필요한 정보가 부족합니다.',
    summary:
      '주소, 보증금 등 핵심 정보가 없거나 API 데이터가 부족해 위험도를 판단하기 어렵습니다. ' +
      '정보를 입력하면 더 정확한 분석을 제공할 수 있습니다.',
  },
};

const COMMON_QUESTIONS = [
  '이 집 등기부등본을 오늘 날짜 기준으로 직접 확인할 수 있나요?',
  '등기부등본상 소유자와 계약 상대방이 같은 분이 맞나요?',
  '근저당이나 선순위 권리(압류, 가처분 등)가 있나요?',
  '전입신고와 확정일자를 입주 당일 바로 받을 수 있나요?',
  '보증보험(HUG·HF·SGI) 가입이 가능한 집인가요?',
  '건축물대장상 위반건축물 여부를 확인하셨나요?',
  '계약서 특약에 보증금 보호 관련 문구를 넣을 수 있나요?',
];

const COMMON_SPECIAL_TERMS = [
  '임대인은 잔금일 이후 추가 근저당권 등 제한물권을 설정하지 않는다.',
  '임대인은 임차인의 전입신고 및 확정일자 취득에 협조한다.',
  '임대인의 귀책으로 전세보증보험 가입이 불가한 경우 임차인은 계약을 해제할 수 있다.',
  '계약 체결 후 등기부등본상 중대한 권리 변동 시 임차인은 계약 해제 및 보증금 전액 반환을 요구할 수 있다.',
];

/**
 * riskSignals 배열을 받아 최종 신호등 판정을 반환한다.
 * 점수는 내부 계산에만 사용하고 절대 사용자에게 노출하지 않는다.
 */
export function decide(signals: RiskSignal[]): RiskDecision {
  const criticals = signals.filter(s => s.severity === 'critical');
  const warnings  = signals.filter(s => s.severity === 'warning');
  const safes     = signals.filter(s => s.severity === 'safe');
  const unknowns  = signals.filter(s => s.severity === 'unknown');

  // 회색불: 핵심 데이터 없음
  const hasAnyData = signals.some(s => s.severity !== 'unknown');
  if (!hasAnyData) {
    return build('gray', criticals, warnings, safes, unknowns);
  }

  // 빨간불: critical 1개 이상 또는 warning 4개 이상
  if (criticals.length >= 1 || warnings.length >= 4) {
    return build('red', criticals, warnings, safes, unknowns);
  }

  // 노란불: warning 1개 이상 또는 핵심 unknown 2개 이상
  const coreUnknowns = unknowns.filter(s =>
    ['price', 'building', 'procedure'].includes(s.category)
  );
  if (warnings.length >= 1 || coreUnknowns.length >= 2) {
    return build('yellow', criticals, warnings, safes, unknowns);
  }

  // 초록불
  return build('green', criticals, warnings, safes, unknowns);
}

function build(
  light: TrafficLight,
  criticals: RiskSignal[],
  warnings: RiskSignal[],
  safes: RiskSignal[],
  unknowns: RiskSignal[],
): RiskDecision {
  const copy = TRAFFIC_COPY[light];
  return {
    light,
    headline: copy.headline,
    summary: copy.summary,
    criticalSignals: criticals,
    warningSignals: warnings,
    safeSignals: safes,
    unknownSignals: unknowns,
    questions: COMMON_QUESTIONS,
    specialTerms: COMMON_SPECIAL_TERMS,
  };
}
