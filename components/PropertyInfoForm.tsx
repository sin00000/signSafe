'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FormData, PropertyType, AnalysisStatus } from '@/types/rent';
import { extractLawdCd } from '@/lib/lawdCodeMap';
import { manWonToKorean as toKorean } from '@/lib/formatMoney';

/* ── 콤마 포맷 금액 입력 컴포넌트 ───────────────────────── */
function MoneyField({
  label, hint, value, onChange, onSkip, placeholder = '0',
}: {
  label: string; hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  onSkip: () => void;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(
    value !== null && value > 0 ? value.toLocaleString('ko-KR') : ''
  );

  // 외부에서 null로 바뀌면 (건너뜀 클릭 시) 입력값 초기화
  useEffect(() => {
    if (value === null) setDisplay('');
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) { setDisplay(''); onChange(null); return; }
    const num = parseInt(digits, 10);
    setDisplay(num.toLocaleString('ko-KR')); // 3자리 콤마
    onChange(num);
  };

  const korean = value !== null && value > 0 ? toKorean(value) : '';

  return (
    <div>
      <label className="text-[12px] font-black text-[#111] block mb-1">
        {label}
        {hint && <span className="text-[10px] text-[#888] font-normal ml-1">{hint}</span>}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            inputMode="numeric"
            value={display}
            onChange={e => handleChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] text-right font-bold focus:outline-none focus:border-[#111] transition-colors pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#888] pointer-events-none">만원</span>
        </div>
        <button type="button" onClick={onSkip}
          className={`px-2.5 text-[11px] font-bold rounded border transition-all whitespace-nowrap ${
            value === null ? 'border-[#009688] text-[#009688] bg-[#F0FAFA]' : 'border-[#E0E0E0] text-[#888] hover:border-[#888]'
          }`}
        >
          {value === null ? '건너뜀' : '몰라요'}
        </button>
      </div>
      {korean && (
        <p className="text-[12px] text-[#009688] font-bold mt-1 pl-0.5">= {korean}</p>
      )}
    </div>
  );
}

interface Props {
  form: FormData;
  onChange: (next: FormData) => void;
  status: AnalysisStatus;
  onSkip: () => void;
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'apartment', label: '아파트' },
  { value: 'villa',     label: '연립다세대' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'detached',  label: '단독다가구' },
];

function SkipBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-all whitespace-nowrap ${
        active ? 'border-[#009688] text-[#009688] bg-[#F0FAFA]' : 'border-[#E0E0E0] text-[#888] hover:border-[#888]'
      }`}
    >
      {active ? '건너뜀' : '몰라요'}
    </button>
  );
}

function TogBtn({ active, onClick, label, warn }: { active: boolean; onClick: () => void; label: string; warn?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 text-[11px] font-bold rounded border-2 transition-all"
      style={active
        ? { borderColor: warn ? '#CC1100' : '#111', background: warn ? '#CC1100' : '#111', color: '#fff' }
        : { borderColor: '#E0E0E0', color: '#888', background: '#fff' }
      }
    >
      {label}
    </button>
  );
}

export default function PropertyInfoForm({ form, onChange, status, onSkip }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addressWarning, setAddressWarning] = useState('');

  // ── 주소 입력 로컬 상태 (타이핑 끊김 방지) ─────────────────
  const [localAddress, setLocalAddress] = useState(form.address);
  const [geocoding, setGeocoding]       = useState(false);
  const [dongDisplay, setDongDisplay]   = useState(form.dongName ?? '');
  const lastLawdCd   = useRef(form.lawdCd);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddress = useCallback((val: string) => {
    setLocalAddress(val);

    // 시군구 즉시 인식
    const lawdCd = extractLawdCd(val);
    if (val.length > 3 && !lawdCd) {
      setAddressWarning('지역을 인식하지 못했습니다. 구·시·군 이름을 포함해 입력하세요. 예: 마포구, 수원시 영통구');
    } else {
      setAddressWarning('');
    }

    // 시군구 바뀌면 동 초기화 후 부모 업데이트
    if (lawdCd !== lastLawdCd.current) {
      lastLawdCd.current = lawdCd ?? null;
      setDongDisplay('');
      onChange({ ...form, address: val, lawdCd: lawdCd ?? null, bjdongCd: null, dongName: null });
    }

    // 동 단위 정밀 지오코딩 (1.2초 debounce)
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (val.length < 5) return;
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(val)}`);
        if (!res.ok) return;
        const geo = await res.json() as {
          lawdCd: string; bjdongCd: string; dongName: string;
          pnu: string | null; parcelNo: string | null; displayAddress: string;
        };
        setDongDisplay(geo.dongName ?? '');
        lastLawdCd.current = geo.lawdCd;
        onChange({
          ...form, address: val,
          lawdCd:   geo.lawdCd,
          bjdongCd: geo.bjdongCd,
          dongName: geo.dongName,
          pnu:      geo.pnu ?? null,
        });
      } catch { /* 무시 */ } finally {
        setGeocoding(false);
      }
    }, 1200);
  }, [form, onChange]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) => onChange({ ...form, [key]: val });

  const statusBar = () => {
    if (status === 'loading') return { text: '분석 중', color: '#F5B400', pulse: true };
    if (status === 'success') return { text: '분석 완료', color: '#22C55E', pulse: false };
    if (status === 'noData')  return { text: '데이터 부족', color: '#888', pulse: false };
    if (status === 'error')   return { text: '오류', color: '#CC1100', pulse: false };
    return { text: '대기 중', color: '#E0E0E0', pulse: false };
  };
  const sb = statusBar();

  return (
    <div className="bg-white rounded-xl border-2 border-[#111] overflow-hidden">
      {/* 헤더 */}
      <div className="bg-[#111] px-4 py-3 flex items-center justify-between">
        <span className="text-white font-black text-[13px]">계약 정보 입력</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${sb.pulse ? 'animate-pulse' : ''}`} style={{ background: sb.color }} />
          <span className="text-white/60 text-[11px]">{sb.text}</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* 주소 */}
        <div>
          <label className="text-[12px] font-black text-[#111] block mb-1">
            주소 <span className="text-[10px] text-[#888] font-normal">(서울 구 단위)</span>
          </label>
          <input
            type="text"
            value={localAddress}
            onChange={e => handleAddress(e.target.value)}
            placeholder="예: 마포구 서교동, 강남구 역삼동"
            className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] focus:outline-none focus:border-[#111] transition-colors"
          />
          <p className="text-[10px] text-[#888] mt-1 leading-relaxed">
            "구 + 동"까지만 입력하면 충분해요. (예: 강남구 역삼동) 번지·건물명·우편번호는 적지 않아도 결과는 동일합니다.
          </p>
          {addressWarning
            ? <p className="text-[11px] text-[#CC1100] mt-1 font-medium">{addressWarning}</p>
            : geocoding
              ? <p className="text-[11px] text-[#888] mt-1">동 단위 확인 중…</p>
              : dongDisplay
                ? <p className="text-[11px] text-[#009688] mt-1 font-bold">✓ {dongDisplay} 인식됨 (동 단위)</p>
                : form.lawdCd
                  ? <p className="text-[11px] text-[#009688] mt-1 font-bold">✓ {localAddress.match(/[가-힣]+(구|시|군)/)?.[0]} 인식됨</p>
                  : null
          }
        </div>

        {/* 주택유형 */}
        <div>
          <label className="text-[12px] font-black text-[#111] block mb-1.5">주택유형</label>
          <div className="grid grid-cols-2 gap-1.5">
            {PROPERTY_TYPES.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => set('propertyType', value)}
                className="py-2 text-[12px] font-bold rounded border-2 transition-all"
                style={form.propertyType === value
                  ? { borderColor: '#111', background: '#111', color: '#fff' }
                  : { borderColor: '#E0E0E0', color: '#888' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 보증금 */}
        <MoneyField
          label="보증금"
          value={form.deposit}
          onChange={v => set('deposit', v)}
          onSkip={() => set('deposit', form.deposit === null ? 0 : null)}
          placeholder="예: 20,000"
        />

        {/* 월세 */}
        <MoneyField
          label="월세"
          hint="(전세면 0 또는 건너뛰기)"
          value={form.monthlyRent}
          onChange={v => set('monthlyRent', v)}
          onSkip={() => set('monthlyRent', form.monthlyRent === null ? 0 : null)}
          placeholder="전세면 0"
        />

        {/* 계약 예정월 */}
        <div>
          <label className="text-[12px] font-black text-[#111] block mb-1">계약 예정월</label>
          <input
            type="month"
            value={form.dealYm}
            onChange={e => set('dealYm', e.target.value)}
            className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] font-bold focus:outline-none focus:border-[#111] transition-colors"
          />
        </div>

        {/* ── 정확도 향상 입력 (선택) ──────────────────── */}
        <div className="border-t-2 border-dashed border-[#E0E0E0] pt-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[11px] font-black text-[#009688] uppercase tracking-wider">정밀 분석 정보</div>
            <div className="text-[10px] text-[#888]">입력하면 계산 정확도가 크게 올라갑니다</div>
          </div>

          {/* 단지명 */}
          <div className="mb-3">
            <label className="text-[12px] font-black text-[#111] block mb-1">단지명 / 건물명</label>
            <input
              type="text"
              value={form.buildingName}
              onChange={e => set('buildingName', e.target.value)}
              placeholder="예: 래미안 마포리버웰, 서교동 아이파크"
              className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] focus:outline-none focus:border-[#009688] transition-colors"
            />
            {form.buildingName && (
              <p className="text-[11px] text-[#009688] mt-1 font-bold">✓ 같은 단지 거래만 비교합니다</p>
            )}
          </div>

          {/* 전용면적 */}
          <div className="mb-3">
            <label className="text-[12px] font-black text-[#111] block mb-1">
              전용면적 <span className="text-[10px] text-[#888] font-normal">(㎡ · 계약서에 있음)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={form.area === null ? '' : form.area}
                  onChange={e => set('area', e.target.value === '' ? null : parseFloat(e.target.value))}
                  placeholder="예: 84.99"
                  step="0.01"
                  className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] text-right font-bold focus:outline-none focus:border-[#009688] transition-colors pr-9"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#888]">㎡</span>
              </div>
              <button type="button" onClick={() => set('area', null)}
                className={`px-2.5 text-[11px] font-bold rounded border whitespace-nowrap transition-all ${
                  form.area === null ? 'border-[#009688] text-[#009688] bg-[#F0FAFA]' : 'border-[#E0E0E0] text-[#888]'
                }`}
              >
                {form.area === null ? '건너뜀' : '몰라요'}
              </button>
            </div>
            {form.area && (
              <p className="text-[11px] text-[#009688] mt-1 font-bold">
                ✓ 유사 면적(±{Math.round(Math.max(10, form.area * 0.25))}㎡) 거래만 비교합니다
              </p>
            )}
          </div>

          {/* 층수 */}
          <div className="mb-3">
            <label className="text-[12px] font-black text-[#111] block mb-1">
              층수 <span className="text-[10px] text-[#888] font-normal">(해당 세대 층 · 선택)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={form.floor === null ? '' : form.floor}
                  onChange={e => set('floor', e.target.value === '' ? null : parseInt(e.target.value))}
                  placeholder="예: 7"
                  min="1"
                  className="w-full border-2 border-[#E0E0E0] rounded px-3 py-2 text-[13px] text-right font-bold focus:outline-none focus:border-[#009688] transition-colors pr-9"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#888]">층</span>
              </div>
              <button type="button" onClick={() => set('floor', null)}
                className={`px-2.5 text-[11px] font-bold rounded border whitespace-nowrap ${
                  form.floor === null ? 'border-[#009688] text-[#009688] bg-[#F0FAFA]' : 'border-[#E0E0E0] text-[#888]'
                }`}
              >
                {form.floor === null ? '건너뜀' : '몰라요'}
              </button>
            </div>
            {form.floor && (
              <p className="text-[11px] text-[#009688] mt-1 font-bold">✓ {form.floor}층 ±3층 거래와 비교합니다</p>
            )}
          </div>

          {/* 선순위 임차인 보증금 */}
          <MoneyField
            label="선순위 임차인 보증금 합계"
            hint="(이미 살고 있는 다른 세입자가 있으면)"
            value={form.priorTenantDeposit}
            onChange={v => set('priorTenantDeposit', v)}
            onSkip={() => set('priorTenantDeposit', form.priorTenantDeposit === null ? 0 : null)}
            placeholder="없으면 0 또는 건너뛰기"
          />
        </div>

        {/* 필수값 부족 안내 */}
        {(!form.lawdCd || !form.deposit || !form.dealYm) && (
          <div className="bg-[#FFFBF0] border-2 border-[#F5B400] rounded p-3">
            <p className="text-[11px] font-bold text-[#7A5900] mb-1">분석을 시작하려면 아래 항목이 필요합니다</p>
            <ul className="text-[11px] text-[#7A5900] space-y-0.5">
              {!form.lawdCd  && <li>• 서울 구 단위 주소 (예: 마포구)</li>}
              {!form.deposit && <li>• 보증금</li>}
              {!form.dealYm  && <li>• 계약 예정월</li>}
            </ul>
          </div>
        )}

        {/* 추가 분석 정보 (토글) */}
        <div className="border-t border-[#F0F0F0] pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between text-[12px] font-bold text-[#555] hover:text-[#111] transition-colors"
          >
            <span>추가 분석 정보 <span className="text-[#888] font-normal">(전세가율·근저당 등)</span></span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {showAdvanced ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
            </svg>
          </button>

          {showAdvanced && (
            <div className="mt-3 flex flex-col gap-3.5">
              {/* 집값 */}
              <div>
                <MoneyField
                  label="주택 예상 매매가"
                  hint="(전세가율 계산용)"
                  value={form.housePrice}
                  onChange={v => set('housePrice', v)}
                  onSkip={() => set('housePrice', null)}
                  placeholder="KB부동산·실거래가 기준"
                />
                {form.housePrice && form.deposit && (
                  <p className="text-[11px] mt-1 font-bold"
                    style={{ color: (form.deposit/form.housePrice*100) >= 80 ? '#CC1100' : (form.deposit/form.housePrice*100) >= 70 ? '#F5B400' : '#009688' }}>
                    전세가율 {Math.round(form.deposit/form.housePrice*100)}%
                  </p>
                )}
              </div>

              {/* 근저당 */}
              <div>
                <label className="text-[11px] font-black text-[#111] block mb-1.5">근저당 여부</label>
                <div className="flex gap-2 mb-2">
                  <TogBtn active={form.hasMortgage === false} onClick={() => set('hasMortgage', false)} label="없음" />
                  <TogBtn active={form.hasMortgage === true} onClick={() => set('hasMortgage', true)} label="있음" warn />
                  <TogBtn active={form.hasMortgage === null} onClick={() => set('hasMortgage', null)} label="모름" />
                </div>
                {form.hasMortgage === true && (
                  <div>
                    <MoneyField
                      label="채권최고액"
                      hint="(등기부 을구 기준)"
                      value={form.mortgageAmount}
                      onChange={v => set('mortgageAmount', v)}
                      onSkip={() => set('mortgageAmount', null)}
                      placeholder="채권최고액 입력"
                    /></div>
                )}
              </div>

              {/* 소유자 일치 */}
              <div>
                <label className="text-[11px] font-black text-[#111] block mb-1.5">등기부 소유자 = 계약 상대방</label>
                <div className="flex gap-2">
                  <TogBtn active={form.isOwnerMatch === true}  onClick={() => set('isOwnerMatch', true)}  label="일치" />
                  <TogBtn active={form.isOwnerMatch === false} onClick={() => set('isOwnerMatch', false)} label="불일치" warn />
                  <TogBtn active={form.isOwnerMatch === null}  onClick={() => set('isOwnerMatch', null)}  label="미확인" />
                </div>
              </div>

              {/* 선순위 권리 */}
              <div>
                <label className="text-[11px] font-black text-[#111] block mb-1.5">선순위 권리 (압류·가압류·가처분)</label>
                <div className="flex gap-2">
                  <TogBtn active={form.hasPriorLiens === false} onClick={() => set('hasPriorLiens', false)} label="없음" />
                  <TogBtn active={form.hasPriorLiens === true}  onClick={() => set('hasPriorLiens', true)}  label="있음" warn />
                  <TogBtn active={form.hasPriorLiens === null}  onClick={() => set('hasPriorLiens', null)}  label="모름" />
                </div>
              </div>

              {/* 전입신고·확정일자·보증보험 */}
              {[
                { key: 'canRegister',     label: '전입신고 가능 여부' } as const,
                { key: 'canGetFixedDate', label: '확정일자 가능 여부' } as const,
                { key: 'canInsure',       label: '보증보험 가입 가능 여부' } as const,
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[11px] font-black text-[#111] block mb-1.5">{label}</label>
                  <div className="flex gap-2">
                    <TogBtn active={form[key] === true}  onClick={() => set(key, true)}  label="가능" />
                    <TogBtn active={form[key] === false} onClick={() => set(key, false)} label="불가" warn />
                    <TogBtn active={form[key] === null}  onClick={() => set(key, null)}  label="모름" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 건너뛰기 */}
        <div className="pt-1 border-t border-[#F0F0F0]">
          <button type="button" onClick={onSkip}
            className="w-full text-[12px] text-[#888] py-2 hover:text-[#555] transition-colors"
          >
            집 정보가 아직 없어요 — 기본 점검만 할게요 →
          </button>
        </div>
      </div>
    </div>
  );
}
