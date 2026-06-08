import { FormData, RentAnalysisResult } from '@/types/rent';
import { formatDealYm } from './dateUtils';

export async function fetchRentAnalysis(form: FormData): Promise<RentAnalysisResult> {
  if (!form.lawdCd || !form.deposit || !form.dealYm) {
    throw new Error('MISSING_REQUIRED');
  }

  const params = new URLSearchParams({
    propertyType: form.propertyType,
    lawdCd:       form.lawdCd,
    dealYm:       formatDealYm(form.dealYm),
    deposit:      String(form.deposit),
    monthlyRent:  String(form.monthlyRent ?? 0),
    address:      form.address,
  });

  // 추가 분석 파라미터 (null이 아닌 것만)
  const optionals: Array<[string, unknown]> = [
    ['housePrice',     form.housePrice],
    ['mortgageAmount', form.mortgageAmount],
    ['hasMortgage',    form.hasMortgage],
    ['hasPriorLiens',  form.hasPriorLiens],
    ['isOwnerMatch',   form.isOwnerMatch],
    ['canRegister',    form.canRegister],
    ['canGetFixedDate',form.canGetFixedDate],
    ['canInsure',      form.canInsure],
    ['bjdongCd',            form.bjdongCd],
    ['pnu',                 form.pnu],
    ['area',                form.area],
    ['buildingName',        form.buildingName || null],
    ['priorTenantDeposit',  form.priorTenantDeposit],
    ['floor',               form.floor],
    ['dongName',            form.dongName || null],
  ];
  for (const [key, val] of optionals) {
    if (val !== null && val !== undefined) params.set(key, String(val));
  }

  const res = await fetch(`/api/rent?${params}`);
  const json: RentAnalysisResult = await res.json();

  if (!res.ok) throw new Error((json as { errorMessage?: string }).errorMessage ?? '서버 오류');
  return json;
}
