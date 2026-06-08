'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { STEP_NAMES, CHECKS_BY_STEP, CheckStatus } from '@/lib/checkData';
import { FormData, RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { PriceCompareCalc, HousePriceCalc, JeonseRateCalc, MortgageCalc } from './CheckCalculators';

/* ── 추가 정보·계산이 필요한 체크 항목 (예외적으로 건너뛰기 허용) ── */
const CALC_RENDERERS: Record<string, (p: CalcProps) => React.ReactNode> = {
  s2i0: p => <PriceCompareCalc form={p.form} onFormChange={p.onFormChange} result={p.analysisResult} status={p.analysisStatus} onRun={p.onRunAnalysis} />,
  s2i1: p => <JeonseRateCalc form={p.form} onFormChange={p.onFormChange} />,
  s2i2: p => <HousePriceCalc form={p.form} onFormChange={p.onFormChange} />,
  s3i1: p => <MortgageCalc form={p.form} onFormChange={p.onFormChange} />,
};

interface CalcProps {
  form: FormData;
  onFormChange: (next: FormData) => void;
  analysisResult: RentAnalysisResult | null;
  analysisStatus: AnalysisStatus;
  onRunAnalysis: (f: FormData) => void;
}

/* ── 색상 ────────────────────────────────────────────────── */
const STATUS_BORDER: Record<CheckStatus, string> = {
  danger: '#CC1100', caution: '#F5B400', done: '#009688', pending: '#888',
};

/* ── 상태(빨강·노랑·초록)에 따른 표정 픽토그램 ───────────────── */
function FaceIcon({ status, color }: { status: CheckStatus; color: string }) {
  // 끝이 끊긴 선으로 그린 듯한 느낌 — butt cap, 둥글림 없이
  const stroke = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'butt' as const, strokeLinejoin: 'miter' as const };
  let face: React.ReactNode;
  if (status === 'danger') {
    // 화난 표정 — 잔뜩 찌푸린 八자 눈썹 + 가늘게 뜬 눈 + 일자로 꽉 다문 채 양끝이 처진 입
    face = <>
      <line x1="5.5" y1="6.5" x2="10" y2="9.5" {...stroke} />
      <line x1="18.5" y1="6.5" x2="14" y2="9.5" {...stroke} />
      <line x1="6.5" y1="11.5" x2="10" y2="11" {...stroke} />
      <line x1="17.5" y1="11.5" x2="14" y2="11" {...stroke} />
      <path d="M7 19 L9 16.5 L15 16.5 L17 19" {...stroke} />
    </>;
  } else if (status === 'caution') {
    // 무표정 — 일자 눈썹 + 끊긴 일자 눈 + 살짝 처진 입
    face = <>
      <line x1="6.5" y1="8.5" x2="10.5" y2="8.5" {...stroke} />
      <line x1="13.5" y1="8.5" x2="17.5" y2="8.5" {...stroke} />
      <line x1="7" y1="11.5" x2="10" y2="11.5" {...stroke} />
      <line x1="14" y1="11.5" x2="17" y2="11.5" {...stroke} />
      <path d="M8.5 17 Q12 14.5 15.5 17" {...stroke} />
    </>;
  } else {
    // 웃는 표정 — 살짝 올라간 눈썹 + 끊긴 곡선 눈 + 둥글게 올라간 입
    face = <>
      <path d="M6.5 9 Q8.5 7.8 10.5 9" {...stroke} />
      <path d="M13.5 9 Q15.5 7.8 17.5 9" {...stroke} />
      <path d="M7.5 11.5 Q9 10.5 10.5 11.5" {...stroke} />
      <path d="M13.5 11.5 Q15 10.5 16.5 11.5" {...stroke} />
      <path d="M8 15 Q12 19.5 16 15" {...stroke} />
    </>;
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ display: 'block' }}>
      {face}
    </svg>
  );
}

/* ── 왼쪽 지하철 노선도 ──────────────────────────────────── */
function SubwayRail({
  confirmedIds, activeStep, onSelect,
}: {
  confirmedIds: Set<string>;
  activeStep: number;
  onSelect: (si: number) => void;
}) {
  const total    = CHECKS_BY_STEP.reduce((a, s) => a + s.length, 0);
  const totalDone = CHECKS_BY_STEP.reduce((a, s) =>
    a + s.filter(c => confirmedIds.has(c.id)).length, 0);
  const stepDone  = (si: number) => CHECKS_BY_STEP[si].every(c => confirmedIds.has(c.id));
  const stepCount = (si: number) => CHECKS_BY_STEP[si].filter(c => confirmedIds.has(c.id)).length;
  const allDone   = totalDone === total;

  return (
    <div className="hidden lg:flex lg:flex-col" style={{
      width: 192, flexShrink: 0,
      borderRight: '2px solid #E0E0E0',
      background: '#fff',
      overflowY: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '2px solid #E0E0E0' }}>
        <div style={{ fontSize: 8, fontWeight: 900, color: '#888', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
          계약 여정
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: totalDone > 0 ? '#009688' : '#888', transition: 'color .3s' }}>
          {totalDone} / {total} 확인 완료
        </div>
        <div style={{ height: 3, background: '#E0E0E0', borderRadius: 2, marginTop: 6 }}>
          <div style={{ height: '100%', width: `${(totalDone / total) * 100}%`, background: '#009688', borderRadius: 2, transition: 'width .4s' }} />
        </div>
      </div>

      {/* 노선 */}
      <div style={{ flex: 1, position: 'relative', padding: '10px 0 6px' }}>
        {/* 배경 선 */}
        <div style={{ position: 'absolute', left: 28, top: 20, bottom: 26, width: 3, background: '#E0E0E0', borderRadius: 2 }} />
        {/* 진행 선 */}
        <div style={{
          position: 'absolute', left: 28, top: 20, width: 3, borderRadius: 2, background: '#009688',
          height: `calc(${(totalDone / total) * 90}% - 20px)`, transition: 'height .5s ease',
        }} />

        {STEP_NAMES.map((name, si) => {
          const done = stepDone(si), cur = si === activeStep, cnt = stepCount(si);
          return (
            <button key={si} onClick={() => onSelect(si)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
              padding: '6px 12px 6px 6px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', position: 'relative', zIndex: 1,
              borderLeft: `3px solid ${done ? '#009688' : cnt > 0 ? '#F5B400' : 'transparent'}`,
            }}>
              {/* 역 도트 */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginLeft: 8,
                border: (!done && !cur) ? '2px solid #E0E0E0' : 'none',
                background: done ? '#009688' : cur ? '#009688' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s',
                boxShadow: cur && !done ? '0 0 0 0 rgba(0,150,136,.45)' : 'none',
                animation: cur && !done ? 'pulse 2.2s ease-in-out infinite' : 'none',
              }}>
                {done
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : cur ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                  : <span style={{ fontSize: 9, fontWeight: 800, color: '#888' }}>{si + 1}</span>
                }
              </div>
              {/* 이름 + 도트 */}
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 12, fontWeight: done || cur ? 800 : 500, color: done ? '#009688' : cur ? '#111' : '#888', lineHeight: 1.2, marginBottom: 3 }}>
                  {name}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {CHECKS_BY_STEP[si].map(c => (
                    <div key={c.id} style={{ width: 5, height: 5, borderRadius: '50%', background: confirmedIds.has(c.id) ? '#009688' : '#E0E0E0', transition: 'background .2s' }} />
                  ))}
                </div>
              </div>
            </button>
          );
        })}

        {/* 목적지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 4px 6px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginLeft: 8, border: `3px solid ${allDone ? '#009688' : '#E0E0E0'}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .5s' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: allDone ? '#009688' : '#E0E0E0', transition: 'background .5s' }} />
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 900, color: allDone ? '#005C54' : '#888', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 1 }}>목적지</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: allDone ? '#009688' : '#888' }}>안전한 입주</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 체크 카드 ────────────────────────────────────────────── */
function CheckCard({ check, confirmed, onToggle, skipped, onToggleSkip, calcProps }: {
  check: import('@/lib/checkData').CheckItem;
  confirmed: Set<string>;
  onToggle: (id: string) => void;
  skipped: Set<string>;
  onToggleSkip: (id: string) => void;
  calcProps: CalcProps;
}) {
  const [open, setOpen] = useState(false);
  const [actionsDone, setActionsDone] = useState(new Set<number>());

  const isDone    = confirmed.has(check.id);
  const isSkipped = isDone && skipped.has(check.id);
  const status    = isDone ? 'done' : check.risk;
  const borderColor = STATUS_BORDER[status];
  // 박스 배경(빨강·노랑) 위에서 읽히는 글자/아이콘 색
  const onColor = status === 'danger' ? '#fff' : status === 'caution' ? '#111' : '#888';
  const calcRenderer = CALC_RENDERERS[check.id];

  const toggleAction = (i: number) => {
    setActionsDone(p => {
      const n = new Set(p);
      n.has(i) ? n.delete(i) : n.add(i);
      if (n.size === check.actions.length && !isDone) onToggle(check.id);
      return n;
    });
  };

  return (
    <div style={{
      border: `2px solid ${isDone ? '#009688' : borderColor}`,
      borderRadius: 10, background: isDone ? '#F0FAFA' : borderColor,
      marginBottom: 16, overflow: 'hidden', transition: 'border-color .2s, background .2s',
    }}>
      {/* 카드 헤더 — 클릭해서 펼치기, 화면의 약 40-50%를 차지. 글·체크는 위, 픽토그램은 아래 */}
      <div onClick={() => setOpen(v => !v)} style={{
        display: 'flex', flexDirection: 'column',
        minHeight: '40vh', padding: '28px 22px', cursor: 'pointer', userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
          {/* 원형 확인 버튼 */}
          <button onClick={e => {
            e.stopPropagation();
            // 대주제(메인 체크)를 체크하면 그 아래 할 일 체크리스트도 함께 모두 체크/해제됨
            setActionsDone(isDone ? new Set() : new Set(check.actions.map((_, i) => i)));
            onToggle(check.id);
          }} style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            border: isDone ? 'none' : `2.5px solid ${onColor}`,
            background: isDone ? '#009688' : 'transparent',
            opacity: isDone ? 1 : 0.7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s',
          }}>
            {isDone && <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
          </button>

          {/* 제목 — 경고문구처럼 더 크고 강하게, 가운데 정렬, 하이프네이션 없이, 폰/노트북 반응형 */}
          <p
            className="flex-1 text-[26px] sm:text-[32px] lg:text-[38px] font-black leading-[1.35] tracking-tight text-center"
            style={{ color: isDone ? '#005C54' : onColor, wordBreak: 'keep-all', overflowWrap: 'normal' }}
          >
            {check.q}
          </p>

          {/* 화살표 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDone ? '#888' : onColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: isDone ? 1 : 0.7 }}>
            {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
          </svg>
        </div>

        {/* 상황을 한눈에 보여주는 표정 픽토그램 — 빨강(화남)·노랑(무표정)·초록(웃음), 화면 크기별 반응형, 남은 공간을 채우며 중앙 정렬 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="w-44 h-44 sm:w-60 sm:h-60 lg:w-72 lg:h-72">
            <FaceIcon status={status} color={isDone ? '#005C54' : onColor} />
          </div>
        </div>
      </div>

      {/* 펼침 내용 */}
      {open && (
        <div style={{ borderTop: '1px solid #E0E0E0', background: isDone ? '#F0FAFA' : '#fff' }}>
          {/* 확인 전: 경고(위험도에 맞는 빨강/노랑) / 확인 후: 왜 중요했는지(초록)로 전환 — 가운데 정렬
              danger=빨강, caution=노랑으로 카드의 위험도(무드)와 색을 통일 */}
          <div style={{
            padding: '20px 18px', borderBottom: '1px dashed #E0E0E0', textAlign: 'center',
            background: isDone ? '#F0FAFA' : (check.risk === 'caution' ? '#FFFBF0' : '#FFF5F5'),
            transition: 'background .2s',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 9,
              color: isDone ? '#009688' : (check.risk === 'caution' ? '#A37800' : '#CC1100'),
            }}>
              {isDone ? '✓ 이게 왜 중요했냐면' : (check.risk === 'caution' ? '⚠ 주의 — 확인하지 않으면?' : '⚠ 확인하지 않으면?')}
            </div>
            <p style={{
              fontSize: 17, fontWeight: 800, lineHeight: 1.7, wordBreak: 'keep-all', overflowWrap: 'normal',
              color: isDone ? '#00695C' : (check.risk === 'caution' ? '#7A5900' : '#CC1100'), transition: 'color .2s',
            }}>
              {isDone ? check.whyItMatters : check.consequence}
            </p>
          </div>
          {/* 정보 입력 · 자동 계산 (해당 항목만, 정보가 없으면 예외적으로 건너뛸 수 있음) */}
          {calcRenderer && (
            <div style={{ padding: '14px 16px', borderBottom: '1px dashed #E0E0E0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#009688', letterSpacing: '0.14em', textTransform: 'uppercase' }}>지금 바로 계산해보기</div>
                {isSkipped && (
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#888', background: '#F0F0F0', borderRadius: 4, padding: '3px 8px' }}>정보 없이 건너뜀</span>
                )}
              </div>
              {calcRenderer(calcProps)}
              <button
                onClick={e => { e.stopPropagation(); onToggleSkip(check.id); }}
                style={{
                  marginTop: 10, width: '100%', padding: '9px', borderRadius: 6, fontSize: 12, fontWeight: 800,
                  border: `1.5px solid ${isSkipped ? '#009688' : '#E0E0E0'}`,
                  background: isSkipped ? '#F0FAFA' : '#fff',
                  color: isSkipped ? '#009688' : '#888', cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {isSkipped ? '↩ 다시 입력하기' : '아직 정보가 없어요 — 정보 없이 건너뛰고 확인 완료'}
              </button>
            </div>
          )}
          {/* 지금 할 일 */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#111', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>지금 할 일</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* 외부 링크 박스 (해당 항목만 표시) */}
              {check.externalLink && (
                <a
                  href={check.externalLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: '2.5px solid #111', borderRadius: 6, padding: '12px 14px',
                    background: '#fff', textDecoration: 'none', marginBottom: 4,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#111', marginBottom: 2 }}>{check.externalLink.label}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{check.externalLink.sub}</div>
                  </div>
                  <div style={{ width: 34, height: 34, background: '#111', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 10 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </div>
                </a>
              )}
              {check.actions.map((a, i) => {
                const adone = actionsDone.has(i);
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* 순서 번호 — 할 일 순서 표시 (고정) */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: '#111', color: '#fff', fontSize: 11, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i + 1}
                    </div>
                    {/* 완료 체크박스 — 번호와 별도, 직접 체크해서 완료 표시 */}
                    <button onClick={e => { e.stopPropagation(); toggleAction(i); }} aria-label="할 일 완료 체크" style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      border: adone ? 'none' : '2px solid #CFCFCF', cursor: 'pointer',
                      background: adone ? '#009688' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {adone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                    {/* 체크하면 '할 일' 문구가 그 자리에서 '왜 중요한지' 설명으로 완전히 전환됨 */}
                    <div style={{ flex: 1 }}>
                      {adone && (
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#009688', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                          ✓ 완료 — 왜 중요했냐면
                        </div>
                      )}
                      <p style={{ fontSize: 15, fontWeight: 700, color: adone ? '#009688' : '#111', lineHeight: 1.65, transition: 'all .15s' }}>
                        {adone ? a.why : a.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 메인 가이드 뷰 ───────────────────────────────────────── */
export default function GuideView({
  confirmed, onToggle, onResult, skipped, onToggleSkip,
  form, onFormChange, analysisResult, analysisStatus, onRunAnalysis,
}: {
  confirmed: Set<string>;
  onToggle: (id: string) => void;
  onResult: () => void;
  skipped: Set<string>;
  onToggleSkip: (id: string) => void;
  form: FormData;
  onFormChange: (next: FormData) => void;
  analysisResult: RentAnalysisResult | null;
  analysisStatus: AnalysisStatus;
  onRunAnalysis: (f: FormData) => void;
}) {
  const calcProps: CalcProps = { form, onFormChange, analysisResult, analysisStatus, onRunAnalysis };
  const [activeStep, setActiveStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 스크롤 위치로 activeStep 감지
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handler = () => {
      let found = 0;
      STEP_NAMES.forEach((_, si) => {
        const el = document.getElementById(`guide-step-${si}`);
        if (el && el.offsetTop - 64 <= container.scrollTop) found = si;
      });
      setActiveStep(found);
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, []);

  const scrollToStep = useCallback((si: number) => {
    const el = document.getElementById(`guide-step-${si}`);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
    }
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* 왼쪽 지하철 노선도 */}
      <SubwayRail confirmedIds={confirmed} activeStep={activeStep} onSelect={scrollToStep} />

      {/* 오른쪽 스크롤 콘텐츠 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 60px' }}>
        {STEP_NAMES.map((name, si) => (
          <div key={si} id={`guide-step-${si}`} style={{ marginBottom: 30 }}>
            {/* 단계 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2.5px solid #111' }}>
              <div style={{ width: 30, height: 30, background: '#111', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{si + 1}</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#111' }}>{name}</span>
              <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto', fontWeight: 700 }}>
                {CHECKS_BY_STEP[si].filter(c => confirmed.has(c.id)).length}/{CHECKS_BY_STEP[si].length}
              </span>
            </div>
            {/* 카드 목록 */}
            {CHECKS_BY_STEP[si].map(check => (
              <CheckCard key={check.id} check={check} confirmed={confirmed} onToggle={onToggle}
                skipped={skipped} onToggleSkip={onToggleSkip} calcProps={calcProps} />
            ))}
          </div>
        ))}

        {/* 결과 보기 버튼 */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <button onClick={onResult} style={{
            padding: '14px 36px', background: '#009688', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 900,
            cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,150,136,.4)',
          }}>
            분석 결과 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}
