/**
 * 만원 단위 금액을 한국식 표현으로 변환 (입력 필드 보조 표시용)
 * 25000 → "2억 5천만 원"
 * 7500  → "7천 5백만 원"
 * 800   → "800만 원"
 */
export function manWonToKorean(manWon: number): string {
  if (!manWon || manWon <= 0) return '';
  if (manWon >= 10000) {
    const eok  = Math.floor(manWon / 10000);
    const rest = manWon % 10000;
    if (rest === 0)        return `${eok}억 원`;
    if (rest >= 1000)      return `${eok}억 ${Math.floor(rest / 1000)}천만 원`;
    if (rest >= 100)       return `${eok}억 ${Math.floor(rest / 100)}백만 원`;
    return `${eok}억 ${rest}만 원`;
  }
  if (manWon >= 1000) {
    const cheon = Math.floor(manWon / 1000);
    const rest  = manWon % 1000;
    if (rest >= 100) return `${cheon}천 ${Math.floor(rest / 100)}백만 원`;
    return `${cheon}천만 원`;
  }
  if (manWon >= 100)   return `${Math.floor(manWon / 100)}백만 원`;
  return `${manWon}만 원`;
}

/**
 * 원 단위 금액을 한국식 표현으로 변환
 * 200000000 → "2억 원"
 * 150000000 → "1억 5천만 원"
 * 50000000  → "5천만 원"
 * 5000000   → "500만 원"
 */
export function formatWon(amount: number): string {
  if (!amount || amount <= 0) return '–';

  const eok = Math.floor(amount / 100_000_000);
  const rest = amount % 100_000_000;
  const chunman = Math.floor(rest / 10_000_000);
  const baekman = Math.floor((rest % 10_000_000) / 1_000_000);

  if (eok > 0) {
    if (chunman > 0) return `${eok}억 ${chunman}천만 원`;
    if (baekman > 0) return `${eok}억 ${baekman}백만 원`;
    if (rest > 0) {
      const man = Math.floor(rest / 10_000);
      return `${eok}억 ${man}만 원`;
    }
    return `${eok}억 원`;
  }
  if (chunman > 0) {
    return `${chunman}천만 원`;
  }
  const man = Math.floor(amount / 10_000);
  if (man > 0) return `${man}만 원`;
  return `${amount}원`;
}

/**
 * 만원 → 원 변환 (공공API 금액은 만원 단위)
 */
export function manWonToWon(manWon: number): number {
  return manWon * 10_000;
}

/**
 * 원 → 만원 변환
 */
export function wonToManWon(won: number): number {
  return Math.floor(won / 10_000);
}

/**
 * 공공데이터 금액 문자열 → 원 단위 숫자
 * "20,000" → 200000000
 * "500" → 5000000
 */
export function parsePublicApiAmount(str: string | number): number {
  if (typeof str === 'number') return str * 10_000;
  const cleaned = String(str).replace(/[,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num * 10_000;
}
