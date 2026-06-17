'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FormData, RentAnalysisResult, AnalysisStatus, PropertyType } from '@/types/rent';
import { formatWon, manWonToKorean } from '@/lib/formatMoney';
import { formatYm } from '@/lib/dateUtils';

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          sido: string;
          sigungu: string;
          bname: string;
          bcode: string;
        }) => void;
      }) => { open: () => void };
    };
  }
}

/* ── 공용 만원 입력 (콤마 표시) ─────────────────────────────── */
function NumInput({
  label, value, onChange, placeholder = '0', suffix = '만원', koreanColor = '#999',
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  koreanColor?: string;
}) {
  const [display, setDisplay] = useState(value !== null && value > 0 ? value.toLocaleString('ko-KR') : '');
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
      <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 4 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="numeric" value={display}
          onChange={e => handle(e.target.value)} placeholder={placeholder}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', border: 'none', borderBottom: '1.5px solid #DDD',
            padding: '4px 28px 4px 0', fontSize: 13, textAlign: 'right', fontWeight: 700,
            background: 'transparent', outline: 'none', color: '#111',
          }}
          onFocus={e => (e.currentTarget.style.borderBottomColor = '#333')}
          onBlur={e => (e.currentTarget.style.borderBottomColor = '#DDD')}
        />
        <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#AAAAAA', pointerEvents: 'none' }}>{suffix}</span>
      </div>
      {korean && <p style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: koreanColor }}>= {korean}</p>}
    </div>
  );
}

/* ── 공용 계산 박스 래퍼 ────────────────────────────────────── */
function CalcBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div onClick={e => e.stopPropagation()}
      style={{ border: '1.5px solid #E0E0E0', borderRadius: 8, padding: '14px 14px 12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>{title}</div>
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

const API_SERVICE: Record<PropertyType, { name: string; serviceId: string }> = {
  apartment: { name: '아파트 전월세 실거래가 서비스', serviceId: 'RTMSDataSvcAptRent' },
  villa:     { name: '연립·다세대 전월세 실거래가 서비스', serviceId: 'RTMSDataSvcRHRent' },
  officetel: { name: '오피스텔 전월세 실거래가 서비스', serviceId: 'RTMSDataSvcOffiRent' },
  detached:  { name: '단독·다가구 전월세 실거래가 서비스', serviceId: 'RTMSDataSvcSHRent' },
};

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
  const [showDetail, setShowDetail] = useState(!!form.area || !!form.floor);
  const [pyeong, setPyeong] = useState<number | null>(form.area ? Math.round((form.area / 3.3058) * 10) / 10 : null);
  const scriptLoadedRef = useRef(false);

  const ready = !!form.lawdCd && !!form.deposit && !!form.dealYm;

  useEffect(() => {
    if (scriptLoadedRef.current || window.daum?.Postcode) return;
    scriptLoadedRef.current = true;
    const s = document.createElement('script');
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const openPostcode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        const lawdCd = data.bcode.substring(0, 5);
        const dongName = data.bname;
        const address = [data.sido, data.sigungu, data.bname].filter(Boolean).join(' ');
        onFormChange(set(form, { address, lawdCd, dongName }));
      },
    }).open();
  };

  const handlePyeong = (v: number | null) => {
    setPyeong(v);
    onFormChange(set(form, { area: v != null ? Math.round(v * 3.3058 * 10) / 10 : null }));
  };

  const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
    { value: 'apartment', label: '아파트' },
    { value: 'officetel', label: '오피스텔' },
    { value: 'villa', label: '빌라' },
    { value: 'detached', label: '단독·다가구' },
  ];

  const sub: React.CSSProperties = { fontSize: 10, color: '#BBBBBB', marginTop: 4, lineHeight: 1.5 };

  // 필수 3개 필드가 모두 채워지면 자동 조회
  const runKeyRef = useRef('');
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    if (!ready) return;
    const key = `${form.lawdCd}|${form.deposit}|${form.dealYm}|${form.propertyType ?? ''}`;
    if (key === runKeyRef.current) return;
    runKeyRef.current = key;
    const t = setTimeout(() => onRunRef.current(formRef.current), 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, form.lawdCd, form.deposit, form.dealYm, form.propertyType]);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ border: '1.5px solid #E0E0E0', borderRadius: 8, padding: '14px 14px 12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>우리 동네 전세 시세 비교</div>

      {/* 건물 유형 */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 }}>건물 유형</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {PROPERTY_TYPES.map(({ value, label }) => {
            const selected = form.propertyType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={e => { e.stopPropagation(); onFormChange(set(form, { propertyType: value })); }}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 4,
                  border: `1.5px solid ${selected ? '#111' : '#D8D8D8'}`,
                  background: selected ? '#111' : '#fff',
                  color: selected ? '#fff' : '#888',
                  cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {form.propertyType
          ? <p style={sub}>국토교통부 {API_SERVICE[form.propertyType].name} ({API_SERVICE[form.propertyType].serviceId})</p>
          : <p style={sub}>건물 유형을 선택하면 국토교통부 실거래가 공공 API (data.go.kr)로 자동 조회합니다</p>
        }
      </div>

      {/* 주소 */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#111', marginBottom: 4 }}>주소</div>
        <button
          type="button" onClick={openPostcode}
          style={{
            width: '100%', border: 'none', borderBottom: '1.5px solid #DDD',
            padding: '4px 0', fontSize: 13, textAlign: 'left', background: 'transparent',
            color: form.address ? '#111' : '#AAAAAA', fontWeight: form.address ? 700 : 400,
            cursor: 'pointer',
          }}
        >
          {form.address || '주소 검색 →'}
        </button>
        {form.lawdCd
          ? <p style={{ ...sub, color: '#555' }}>{form.dongName ?? form.address} 인식됨</p>
          : <p style={sub}>동·읍·면 단위로 조회합니다</p>
        }
      </div>

      {/* 보증금 + 계약월 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <NumInput label="내 보증금" value={form.deposit} onChange={v => onFormChange(set(form, { deposit: v }))} placeholder="예: 20,000" koreanColor="#888" />
          <p style={sub}>만원 단위</p>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#111', display: 'block', marginBottom: 4 }}>계약 예정월</label>
          <input
            type="month" value={form.dealYm} onChange={e => onFormChange(set(form, { dealYm: e.target.value }))}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', border: 'none', borderBottom: '1.5px solid #DDD', padding: '4px 0', fontSize: 13, fontWeight: 700, background: 'transparent', outline: 'none', color: '#111' }}
            onFocus={e => (e.currentTarget.style.borderBottomColor = '#333')}
            onBlur={e => (e.currentTarget.style.borderBottomColor = '#DDD')}
          />
          <p style={sub}>해당 월 포함 최근 4개월 거래 집계</p>
        </div>
      </div>

      {/* 상세 입력 */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}
        style={{ fontSize: 11, fontWeight: 600, color: '#AAAAAA', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px dashed #E0E0E0', cursor: 'pointer', padding: '0 0 6px', letterSpacing: '-0.01em' }}
      >
        {showDetail ? '상세 입력 접기' : '상세 입력 — 면적·층수를 알면 더 정확해져요'}
      </button>
      {showDetail && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: -6 }}>
          <div>
            <NumInput label="전용면적" value={pyeong} onChange={handlePyeong} placeholder="예: 24" suffix="평" koreanColor="#888" />
            <p style={sub}>같은 평형 거래 우선 비교</p>
          </div>
          <div>
            <NumInput label="층수" value={form.floor} onChange={v => onFormChange(set(form, { floor: v }))} placeholder="예: 5" suffix="층" koreanColor="#888" />
            <p style={sub}>층수가 비슷한 거래 우선</p>
          </div>
        </div>
      )}

      {/* 입력 / 결과 구분선 — 조회가 한 번이라도 실행된 후 표시 */}
      {(status === 'loading' || status === 'success' || status === 'noData' || status === 'error') && (
        <div style={{ borderTop: '1.5px solid #E8E8E8', margin: '0 -14px' }} />
      )}

      {/* 조회 상태 */}
      {status === 'loading' && (
        <p style={{ fontSize: 11, color: '#AAAAAA', textAlign: 'center' }}>실거래가 조회 중…</p>
      )}

      {/* 결과 (색상 있음) */}
      {status === 'success' && result && result.medianJeonseDeposit != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <p style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>{formatYm(result.dealYm)} 기준 · 거래 {result.transactionCount}건 (전세 {result.jeonseCount}건)</p>
          <p style={{ fontSize: 10, color: '#AAAAAA', lineHeight: 1.6 }}>
            {form.dongName ? `${form.dongName} 단위로 비교했습니다.` : '구 단위로 비교했습니다.'} 같은 동 거래가 10건 미만이면 구 전체로 넓혀 비교합니다.
          </p>
        </div>
      )}
      {status === 'noData' && (
        <p style={{ fontSize: 12, color: '#888', fontWeight: 700, textAlign: 'center', padding: '4px 0' }}>최근 거래 데이터가 부족해요. 면적을 입력하면 더 정확해져요.</p>
      )}
      {status === 'error' && (
        <p style={{ fontSize: 12, color: '#CC1100', fontWeight: 700, textAlign: 'center', padding: '4px 0' }}>조회에 실패했어요. 잠시 후 다시 시도하세요.</p>
      )}

      {/* API 출처 — 결과 조회 후 표시 */}
      {(status === 'success' || status === 'noData') && form.propertyType && (
        <p style={{ fontSize: 11, color: '#666', lineHeight: 1.6 }}>
          국토교통부 {API_SERVICE[form.propertyType].name}을 사용합니다
          <span style={{ color: '#AAAAAA' }}> · {API_SERVICE[form.propertyType].serviceId} · data.go.kr</span>
        </p>
      )}

      {/* 호갱노노 — 회색 박스, 아파트는 강조 문구 */}
      <div style={{ background: '#F5F5F5', borderRadius: 6, padding: '10px 12px' }}>
        <p style={{ fontSize: 11, color: '#555', lineHeight: 1.65, margin: '0 0 6px', wordBreak: 'keep-all' }}>
          {form.propertyType === 'apartment'
            ? '아파트는 단지별 시세가 중요해요. 같은 단지 안에서도 층·향·평형에 따라 차이가 크니, 아파트는 여기서 보는 게 더 정확해요.'
            : '건물별·지역별 더 자세한 시세는 호갱노노에서 확인할 수 있어요.'
          }
        </p>
        <a
          href="https://hogangnono.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 700, color: '#444', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          호갱노노 바로가기
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>

    </div>
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
      <p style={{ fontSize: 11, color: '#AAAAAA', lineHeight: 1.55, letterSpacing: '-0.01em' }}>
        입력하면 전세가율·근저당 계산에 자동으로 연동됩니다. 외부 API 없이 직접 입력합니다. KB부동산·호갱노노·실거래가공개시스템에서 확인한 값을 쓰세요.
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
        <p style={{ fontSize: 12, color: '#AAAAAA', textAlign: 'center', padding: '4px 0' }}>보증금과 집값을 입력하면 전세가율이 자동으로 계산돼요.</p>
      )}
      <p style={{ fontSize: 10, color: '#CCCCCC', lineHeight: 1.5, letterSpacing: '-0.01em' }}>외부 API 없이 입력값으로만 계산합니다 · 공식: 보증금 ÷ 집값 × 100</p>
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
            ? { color: '#fff', background: '#333', borderColor: '#333' }
            : { color: '#555', background: '#fff', borderColor: '#D8D8D8' }}
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
        <p style={{ fontSize: 12, color: '#AAAAAA', textAlign: 'center', padding: '4px 0' }}>채권최고액·보증금·집값을 입력하면 위험도가 자동으로 계산돼요.</p>
      )}
      <p style={{ fontSize: 10, color: '#CCCCCC', lineHeight: 1.5, letterSpacing: '-0.01em' }}>외부 API 없이 입력값으로만 계산합니다 · 채권최고액은 등기부등본 을구에서 확인</p>
    </CalcBox>
  );
}
