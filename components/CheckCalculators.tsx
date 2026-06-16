'use client';
import React, { useState, useEffect } from 'react';
import { FormData, RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { extractLawdCd } from '@/lib/lawdCodeMap';
import { formatWon, manWonToKorean } from '@/lib/formatMoney';
import { formatYm } from '@/lib/dateUtils';

/* ── 공용 만원 입력 (콤마 표시) ─────────────────────────────── */
function NumInput({
  label, value, onChange, placeholder = '0', suffix = '만원',
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value !== null && value > 0 ? value.toLocaleString('ko-KR') : '');
  // 같은 필드(보증금·집값 등)가 여러 카드에 공유되므로, 다른 카드에서 값이 바뀌면 함께 갱신
  useEffect(() => {
    setDisplay(value !== null && value > 0 ? value.toLocaleString('ko-KR') : '');
  }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) { setDisplay(''); onChange(null); return; }
    const num = parseInt(digits, 10);
    setDisplay(num.toLocaleString('ko-KR'));
    onChange(num);
  };

  const korean = suffix === '만원' && value !== null && value > 0 ? manWonToKorean(value) : '';

  return (
    <div>
      <label className="text-[11px] font-black text-[#111] block mb-1">{label}</label>
      <div className="relative">
        <input
          type="text" inputMode="numeric" value={display}
          onChange={e => handle(e.target.value)} placeholder={placeholder}
          onClick={e => e.stopPropagation()}
          className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] text-right font-bold focus:outline-none focus:border-[#009688] transition-colors pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#888] pointer-events-none">{suffix}</span>
      </div>
      {korean && <p className="text-[11px] text-[#009688] font-bold mt-1 pl-0.5">= {korean}</p>}
    </div>
  );
}

/* ── 공용 계산 박스 래퍼 ────────────────────────────────────── */
function CalcBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div onClick={e => e.stopPropagation()}
      className="border-2 border-dashed border-[#009688] rounded-lg p-3.5 bg-[#F0FAFA] flex flex-col gap-3"
    >
      <div className="text-[13px] font-black text-[#009688] tracking-tight">{title}</div>
      {children}
    </div>
  );
}

function ResultLine({ label, value, tone }: { label: string; value: string; tone: 'safe' | 'caution' | 'danger' }) {
  const bg = tone === 'danger' ? '#CC1100' : tone === 'caution' ? '#F5B400' : '#009688';
  const fg = tone === 'caution' ? '#111' : '#fff';
  return (
    <div className="flex items-center justify-between rounded-lg px-4 py-4" style={{ background: bg }}>
      <span className="text-[14px] font-bold" style={{ color: fg, opacity: 0.8 }}>{label}</span>
      <span className="text-[20px] font-black" style={{ color: fg }}>{value}</span>
    </div>
  );
}

const set = (form: FormData, patch: Partial<FormData>): FormData => ({ ...form, ...patch });

/* ────────────────────────────────────────────────────────────
 * s2i0 — 주변 시세 비교
 * ──────────────────────────────────────────────────────────── */
export function PriceCompareCalc({
  form, onFormChange, result, status, onRun,
}: {
  form: FormData;
  onFormChange: (next: FormData) => void;
  result: RentAnalysisResult | null;
  status: AnalysisStatus;
  onRun: (f: FormData) => void;
}) {
  const [addr, setAddr] = useState(form.address);
  const [showDetail, setShowDetail] = useState(!!form.area || !!form.floor);
  const [pyeong, setPyeong] = useState<number | null>(form.area ? Math.round((form.area / 3.3058) * 10) / 10 : null);

  const ready = !!form.lawdCd && !!form.deposit && !!form.dealYm;

  const handleAddr = (v: string) => {
    setAddr(v);
    const lawdCd = extractLawdCd(v);
    onFormChange(set(form, { address: v, lawdCd }));
  };

  const handlePyeong = (v: number | null) => {
    setPyeong(v);
    onFormChange(set(form, { area: v != null ? Math.round(v * 3.3058 * 10) / 10 : null }));
  };

  return (
    <CalcBox title="우리 동네 전세 시세 비교">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2">
          <label className="text-[11px] font-black text-[#111] block mb-1">주소 <span className="text-[10px] text-[#888] font-normal">(구 단위, 예: 마포구)</span></label>
          <input
            type="text" value={addr} onChange={e => handleAddr(e.target.value)}
            placeholder="예: 마포구 서교동" onClick={e => e.stopPropagation()}
            className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] focus:outline-none focus:border-[#009688] transition-colors"
          />
          {form.lawdCd
            ? <p className="text-[11px] text-[#009688] mt-1 font-bold">{addr.match(/[가-힣]+(구|시|군)/)?.[0] ?? '지역'} 인식됨</p>
            : addr.length > 3
              ? <p className="text-[11px] text-[#CC1100] mt-1 font-medium">구·시·군 이름을 포함해 입력하세요</p>
              : <p className="text-[10px] text-[#888] mt-1 leading-relaxed">"구 + 동"까지만 입력하면 충분해요. (예: 강남구 역삼동) 번지·건물명·우편번호는 적지 않아도 결과는 동일합니다.</p>}
        </div>
        <NumInput label="내 보증금" value={form.deposit} onChange={v => onFormChange(set(form, { deposit: v }))} placeholder="예: 20,000" />
        <div>
          <label className="text-[11px] font-black text-[#111] block mb-1">계약 예정월</label>
          <input
            type="month" value={form.dealYm} onChange={e => onFormChange(set(form, { dealYm: e.target.value }))}
            onClick={e => e.stopPropagation()}
            className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] font-bold focus:outline-none focus:border-[#009688] transition-colors"
          />
        </div>
      </div>

      {/* 상세 입력 — 면적(평)·층수를 알려주면 비슷한 평형끼리 비교해 시세 정확도가 올라감 */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}
        className="text-[11px] font-bold text-[#009688] text-left hover:underline"
      >
        {showDetail ? '상세 입력 닫기' : '상세 입력 — 면적·층수를 알려주면 더 정확해져요'}
      </button>
      {showDetail && (
        <div className="grid grid-cols-2 gap-2.5 -mt-1">
          <NumInput label="전용면적" value={pyeong} onChange={handlePyeong} placeholder="예: 24" suffix="평" />
          <NumInput label="층수" value={form.floor} onChange={v => onFormChange(set(form, { floor: v }))} placeholder="예: 5" suffix="층" />
        </div>
      )}
      {showDetail && (form.area || form.floor) && (
        <p className="text-[11px] text-[#009688] font-bold leading-relaxed -mt-1">
          비슷한 평형의 거래만 골라 비교하므로 시세 비교 정확도가 올라가요{form.area ? ` (${pyeong}평 ≈ ${form.area}㎡ 기준)` : ''}.
        </p>
      )}

      <button
        type="button" disabled={!ready || status === 'loading'}
        onClick={e => { e.stopPropagation(); onRun(form); }}
        className="w-full py-2.5 rounded text-[13px] font-black transition-colors"
        style={ready ? { background: '#009688', color: '#fff' } : { background: '#E0E0E0', color: '#888', cursor: 'not-allowed' }}
      >
        {status === 'loading' ? '실거래가 조회 중…' : '주변 시세와 비교하기'}
      </button>

      {status === 'success' && result && result.medianJeonseDeposit != null && (
        <div className="flex flex-col gap-2">
          <ResultLine
            label={`최근 ${result.searchedMonths.length}개월 동네 평균 전세금`}
            value={`${formatWon(result.medianJeonseDeposit)}`}
            tone="safe"
          />
          <ResultLine
            label="내 보증금과 비교"
            value={
              result.depositRatio != null
                ? `평균보다 ${result.depositRatio - 100 > 0 ? '+' : ''}${result.depositRatio - 100}%`
                : '–'
            }
            tone={result.depositRatio != null && result.depositRatio - 100 >= 30 ? 'danger' : result.depositRatio != null && result.depositRatio - 100 >= 10 ? 'caution' : 'safe'}
          />
          <p className="text-[11px] text-[#888] leading-relaxed">{formatYm(result.dealYm)} 기준 · 거래 {result.transactionCount}건 (전세 {result.jeonseCount}건)</p>
        </div>
      )}
      {status === 'noData' && (
        <p className="text-[12px] text-[#888] font-bold text-center py-1">최근 거래 데이터가 부족해요. 단지명을 알면 더 정확해져요.</p>
      )}
      {status === 'error' && (
        <p className="text-[12px] text-[#CC1100] font-bold text-center py-1">조회에 실패했어요. 잠시 후 다시 시도하세요.</p>
      )}
    </CalcBox>
  );
}

/* ────────────────────────────────────────────────────────────
 * s2i2 — 집값 확인
 * ──────────────────────────────────────────────────────────── */
export function HousePriceCalc({ form, onFormChange }: { form: FormData; onFormChange: (next: FormData) => void }) {
  return (
    <CalcBox title="주택 예상 매매가 입력">
      <NumInput
        label="KB부동산·실거래가 기준 예상 매매가"
        value={form.housePrice}
        onChange={v => onFormChange(set(form, { housePrice: v }))}
        placeholder="예: 50,000"
      />
      <p className="text-[11px] text-[#009688] font-bold leading-relaxed">
        입력하면 다음 단계 &apos;전세가율 계산&apos;에 자동으로 사용됩니다.
      </p>
    </CalcBox>
  );
}

/* ────────────────────────────────────────────────────────────
 * s2i1 — 전세가율 계산
 * ──────────────────────────────────────────────────────────── */
export function JeonseRateCalc({ form, onFormChange }: { form: FormData; onFormChange: (next: FormData) => void }) {
  const ratio = form.deposit && form.housePrice ? Math.round((form.deposit / form.housePrice) * 100) : null;
  const tone: 'safe' | 'caution' | 'danger' = ratio == null ? 'safe' : ratio >= 80 ? 'danger' : ratio >= 70 ? 'caution' : 'safe';

  return (
    <CalcBox title="전세가율 자동 계산 (전세금 ÷ 집값 × 100)">
      <div className="grid grid-cols-2 gap-2.5">
        <NumInput label="내 보증금" value={form.deposit} onChange={v => onFormChange(set(form, { deposit: v }))} placeholder="예: 20,000" />
        <NumInput label="주택 예상 매매가" value={form.housePrice} onChange={v => onFormChange(set(form, { housePrice: v }))} placeholder="예: 50,000" />
      </div>
      {ratio != null ? (
        <ResultLine
          label="전세가율"
          value={`${ratio}% ${tone === 'danger' ? '· 위험' : tone === 'caution' ? '· 주의' : '· 안전'}`}
          tone={tone}
        />
      ) : (
        <p className="text-[12px] text-[#888] text-center py-1">보증금과 집값을 입력하면 전세가율이 자동으로 계산돼요.</p>
      )}
    </CalcBox>
  );
}

/* ────────────────────────────────────────────────────────────
 * s3i1 — 근저당 위험 계산
 * ──────────────────────────────────────────────────────────── */
export function MortgageCalc({ form, onFormChange }: { form: FormData; onFormChange: (next: FormData) => void }) {
  const sum = (form.mortgageAmount ?? 0) + (form.deposit ?? 0);
  const ratio = form.housePrice && (form.mortgageAmount != null || form.deposit != null)
    ? Math.round((sum / form.housePrice) * 100) : null;
  const tone: 'safe' | 'caution' | 'danger' = ratio == null ? 'safe' : ratio >= 80 ? 'danger' : ratio >= 60 ? 'caution' : 'safe';

  return (
    <CalcBox title="근저당 위험 계산 ((채권최고액 + 내 보증금) ÷ 집값)">
      <div>
        <NumInput label="채권최고액 (등기부 을구 기준)" value={form.mortgageAmount} onChange={v => onFormChange(set(form, { mortgageAmount: v, hasMortgage: v != null ? (v > 0) : null }))} placeholder="없으면 아래 버튼을 눌러주세요" />
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onFormChange(set(form, form.hasMortgage === false ? { mortgageAmount: null, hasMortgage: null } : { mortgageAmount: 0, hasMortgage: false })); }}
          className="mt-1.5 text-[11px] font-bold rounded px-2.5 py-1.5 border-2 transition-colors"
          style={form.hasMortgage === false
            ? { color: '#fff', background: '#009688', borderColor: '#009688' }
            : { color: '#009688', background: '#fff', borderColor: '#009688' }}
        >
          {form.hasMortgage === false ? '✓ 등기부 확인 — 근저당 없음' : '등기부등본에서 근저당 없음을 확인했어요'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <NumInput label="내 보증금" value={form.deposit} onChange={v => onFormChange(set(form, { deposit: v }))} placeholder="예: 20,000" />
        <NumInput label="주택 예상 매매가" value={form.housePrice} onChange={v => onFormChange(set(form, { housePrice: v }))} placeholder="예: 50,000" />
      </div>
      {ratio != null ? (
        <ResultLine
          label="(근저당 + 내 보증금) ÷ 집값"
          value={`${ratio}% ${tone === 'danger' ? '· 위험' : tone === 'caution' ? '· 주의' : '· 안전'}`}
          tone={tone}
        />
      ) : (
        <p className="text-[12px] text-[#888] text-center py-1">채권최고액·보증금·집값을 입력하면 위험도가 자동으로 계산돼요.</p>
      )}
    </CalcBox>
  );
}
