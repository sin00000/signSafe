/**
 * "2026-06" → "202606"
 */
export function formatDealYm(input: string): string {
  return input.replace('-', '').slice(0, 6);
}

/**
 * 현재 년월을 YYYY-MM 형식으로 반환 (input[type=month] 표시용. API 호출 전 formatDealYm으로 변환)
 */
export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * YYYYMM 기준 직전 count개 월을 배열로 반환 (해당 월 포함)
 * 예: "202606", 4 → ["202606","202605","202604","202603"]
 */
export function getPreviousMonths(dealYm: string, count: number): string[] {
  const year = parseInt(dealYm.slice(0, 4));
  const month = parseInt(dealYm.slice(4, 6));

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let m = month - i;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    result.push(`${y}${String(m).padStart(2, '0')}`);
  }
  return result;
}

/**
 * "202606" → "2026년 6월"
 */
export function formatYm(ym: string): string {
  const y = ym.slice(0, 4);
  const m = parseInt(ym.slice(4, 6));
  return `${y}년 ${m}월`;
}

/**
 * YYYY-MM 형식 input value → display용 "2026년 06월"
 */
export function formatYearMonth(value: string): string {
  if (!value) return '';
  const [y, m] = value.split('-');
  return `${y}년 ${m}월`;
}
