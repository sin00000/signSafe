/**
 * 수동 체크 항목 및 문서 분석
 * 사용자가 직접 입력한 체크 결과를 RiskSignal로 변환한다.
 */
import { RiskSignal, UserInput } from '@/types/rent';
import { critical, warning, safe, unknown } from './riskSignals';

export function analyzeDocumentRisk(input: UserInput): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // ── 소유자 일치 ─────────────────────────────────────────
  if (input.isOwnerMatch === false) {
    signals.push(critical(
      'owner_mismatch', 'document',
      '소유자와 계약자가 다릅니다',
      '등기부등본의 소유자와 계약 상대방이 다릅니다. 진짜 집주인이 아닌 사람에게 보증금을 내는 셈으로 계약이 무효가 될 수 있습니다.',
      '사용자 입력: 소유자 불일치',
      '지금 당장 계약을 중단하세요. 등기부등본과 신분증을 직접 대조하세요.',
      '사용자 입력',
    ));
  } else if (input.isOwnerMatch === true) {
    signals.push(safe(
      'owner_match_confirmed', 'document',
      '소유자와 계약자가 일치합니다',
      '등기부등본의 소유자와 계약 상대방이 일치한다고 확인하셨습니다.',
      '사용자 입력: 소유자 일치',
      '계약 당일 재발급 등기부등본으로 다시 한번 확인하세요.',
      '사용자 입력',
    ));
  } else {
    signals.push(warning(
      'owner_match_not_checked', 'procedure',
      '소유자와 계약자 일치 여부를 확인하지 않았습니다',
      '소유자 불일치는 전세사기의 가장 대표적인 수법입니다. 반드시 확인해야 합니다.',
      '사용자 입력: 미확인',
      '등기부등본 갑구의 소유자 이름과 계약자 신분증 이름을 직접 대조하세요.',
      '사용자 입력',
    ));
  }

  // ── 압류·가처분 ────────────────────────────────────────
  if (input.hasSeizure === true) {
    signals.push(critical(
      'seizure_exists', 'document',
      '압류·가압류·가처분이 있습니다',
      '집이 법적으로 묶여 있어 언제든 경매에 넘어갈 수 있습니다. 보증금 손실 위험이 매우 높습니다.',
      '사용자 입력: 압류/가처분 있음',
      '계약을 즉시 중단하고 법무사 또는 HUG(1566-9009)와 상담하세요.',
      '사용자 입력',
    ));
  } else if (input.hasSeizure === false) {
    signals.push(safe(
      'no_seizure', 'document',
      '압류·가처분이 없는 것으로 확인됩니다',
      '등기부등본에서 압류·가처분이 없다고 확인하셨습니다.',
      '사용자 입력: 없음',
      '계약 당일 재발급 등기부등본으로 다시 확인하세요.',
      '사용자 입력',
    ));
  } else {
    signals.push(warning(
      'seizure_not_checked', 'procedure',
      '압류·가처분 여부를 확인하지 않았습니다',
      '압류나 가처분이 있으면 집이 갑자기 경매에 넘어갈 수 있습니다.',
      '사용자 입력: 미확인',
      '등기부등본 갑구에서 압류, 가압류, 가처분 단어를 확인하세요.',
      '사용자 입력',
    ));
  }

  // ── 전입신고 가능 여부 ──────────────────────────────────
  if (input.canRegister === false) {
    signals.push(critical(
      'cannot_register', 'procedure',
      '전입신고를 할 수 없습니다',
      '전입신고 없이는 대항력이 생기지 않아 경매 시 보증금을 보호받을 수 없습니다.',
      '사용자 입력: 전입신고 불가',
      '전입신고가 불가한 이유를 반드시 파악하세요. 주거용이 아닌 건물일 수 있습니다.',
      '사용자 입력',
    ));
  } else if (input.canRegister === null) {
    signals.push(warning(
      'register_not_checked', 'procedure',
      '전입신고 가능 여부를 확인하지 않았습니다',
      '전입신고를 할 수 없으면 보증금 보호 수단이 없어집니다.',
      '사용자 입력: 미확인',
      '입주 당일 전입신고 가능한지 집주인 또는 중개사에게 사전 확인하세요.',
      '사용자 입력',
    ));
  }

  // ── 확정일자 가능 여부 ──────────────────────────────────
  if (input.canGetFixedDate === false) {
    signals.push(critical(
      'cannot_fixed_date', 'procedure',
      '확정일자를 받을 수 없습니다',
      '확정일자 없이는 우선변제권이 생기지 않아 경매 배당에서 밀릴 수 있습니다.',
      '사용자 입력: 확정일자 불가',
      '확정일자를 받을 수 없는 이유를 확인하세요.',
      '사용자 입력',
    ));
  } else if (input.canGetFixedDate === null) {
    signals.push(warning(
      'fixed_date_not_checked', 'procedure',
      '확정일자 가능 여부를 확인하지 않았습니다',
      '확정일자는 보증금 우선변제의 핵심 수단입니다.',
      '사용자 입력: 미확인',
      '전입신고 당일 주민센터에서 무료로 받을 수 있습니다.',
      '사용자 입력',
    ));
  }

  // ── 보증보험 가능 여부 ──────────────────────────────────
  if (input.canInsure === false) {
    signals.push(critical(
      'cannot_insure', 'procedure',
      '전세보증보험 가입이 불가합니다',
      '보증보험 없이는 집주인이 보증금을 안 줄 때 소송 외에 방법이 없습니다.',
      '사용자 입력: 보증보험 불가',
      '왜 불가한지 이유를 파악하세요. 전세가율 문제라면 계약을 재검토하세요.',
      '사용자 입력',
    ));
  } else if (input.canInsure === null) {
    signals.push(warning(
      'insurance_not_checked', 'procedure',
      '전세보증보험 가입 가능 여부를 확인하지 않았습니다',
      '보증보험이 없으면 집주인 귀책의 보증금 반환 문제 발생 시 소송만 가능합니다.',
      '사용자 입력: 미확인',
      'HUG(1566-9009), HF, SGI서울보증 홈페이지에서 사전 조회하세요.',
      '사용자 입력',
    ));
  } else {
    signals.push(safe(
      'insurance_available', 'procedure',
      '전세보증보험 가입이 가능합니다',
      '전세보증보험 가입이 가능해 보증금 보호 수단이 있습니다.',
      '사용자 입력: 가입 가능',
      '계약 후 임대차 기간의 절반이 지나기 전에 바로 가입하세요.',
      '사용자 입력',
    ));
  }

  return signals;
}
