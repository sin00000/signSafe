'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { STEP_NAMES, CHECKS_BY_STEP, CheckStatus } from '@/lib/checkData';
import { FormData, RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { PriceCompareCalc, HousePriceCalc, JeonseRateCalc, MortgageCalc } from './CheckCalculators';
import GuideToolsBar from './GuideToolsBar';

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

const STATUS_COLOR: Record<CheckStatus, string> = {
  danger: '#CC1100', caution: '#B07B00', done: '#007A6E', pending: '#999',
};
const STATUS_BG: Record<CheckStatus, string> = {
  danger: '#FFF0EE', caution: '#FFF8E2', done: '#EDFAF7', pending: '#F5F5F5',
};
const STATUS_BORDER: Record<CheckStatus, string> = {
  danger: '#F5C5BF', caution: '#E8D070', done: '#A8E6DF', pending: '#E0E0E0',
};

/* ── 가로 스텝 진행 바 (노선도 대체) ─────────────────────────── */
function StepBar({ confirmedIds, activeStep, onSelect }: {
  confirmedIds: Set<string>;
  activeStep: number;
  onSelect: (si: number) => void;
}) {
  return (
    <div style={{ borderBottom: '1px solid #E0E0E0', background: '#fff', overflowX: 'auto', flexShrink: 0 }}>
      <div style={{ display: 'flex', padding: '0 6px', minWidth: 'max-content' }}>
        {STEP_NAMES.map((name, si) => {
          const done    = CHECKS_BY_STEP[si].every(c => confirmedIds.has(c.id));
          const partial = CHECKS_BY_STEP[si].some(c => confirmedIds.has(c.id));
          const active  = si === activeStep;
          return (
            <button key={si} onClick={() => onSelect(si)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '9px 10px', border: 'none', background: 'none',
              cursor: 'pointer', flexShrink: 0, userSelect: 'none',
              borderBottom: active ? '2px solid #111' : '2px solid transparent',
              transition: 'border-color .15s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: done ? '#007A6E' : partial ? '#B07B00' : '#DEDEDE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done
                  ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : <span style={{ fontSize: 8, fontWeight: 900, color: partial ? '#7A5900' : '#999' }}>{si + 1}</span>
                }
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 400, color: active ? '#111' : '#999', whiteSpace: 'nowrap' }}>{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── 체크 카드 ────────────────────────────────────────────── */
function CheckCard({ check, confirmed, onToggle, skipped, onToggleSkip, calcProps, open, onOpen }: {
  check: import('@/lib/checkData').CheckItem;
  confirmed: Set<string>;
  onToggle: (id: string) => void;
  skipped: Set<string>;
  onToggleSkip: (id: string) => void;
  calcProps: CalcProps;
  open: boolean;
  onOpen: () => void;
}) {
  const [actionsDone, setActionsDone] = useState(new Set<number>());

  const isDone     = confirmed.has(check.id);
  const isSkipped  = isDone && skipped.has(check.id);
  const status     = isDone ? 'done' : check.risk;
  const accent     = STATUS_COLOR[status];
  const cardBg     = STATUS_BG[status];
  const cardBorder = STATUS_BORDER[status];
  const calcRenderer = CALC_RENDERERS[check.id];

  const toggleAction = (i: number) => {
    setActionsDone(p => {
      const n = new Set(p);
      n.has(i) ? n.delete(i) : n.add(i);
      if (n.size === check.actions.length && !isDone) onToggle(check.id);
      return n;
    });
  };

  const badgeLabel = isDone
    ? (isSkipped ? '건너뜀' : '완료')
    : check.risk === 'danger' ? '위험' : '주의';

  return (
    <div style={{
      marginBottom: 6, background: cardBg, borderRadius: 10, overflow: 'hidden',
      border: `1.5px solid ${cardBorder}`,
      boxShadow: open ? '0 3px 12px rgba(0,0,0,0.08)' : 'none', transition: 'box-shadow .15s',
    }}>
      {/* 접힌 헤더 — 60px 고정 */}
      <div onClick={onOpen} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', height: 60, cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: accent, opacity: 0.5, flexShrink: 0, width: 16, textAlign: 'center' }}>
          {check.itemIdx + 1}
        </span>
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 700,
          color: isDone ? accent : '#111',
          wordBreak: 'keep-all', lineHeight: 1.3,
        }}>
          {check.q}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, flexShrink: 0 }}>
          {badgeLabel}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </div>

      {/* 펼친 내용 */}
      {open && (
        <div style={{ borderTop: `1px solid ${cardBorder}` }}>

          {/* 설명 */}
          <div style={{
            padding: '16px 18px', borderBottom: `1px dashed ${cardBorder}`,
            background: isDone ? 'rgba(0,150,136,0.06)' : 'rgba(0,0,0,0.025)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: accent, marginBottom: 8,
            }}>
              {isDone ? '확인 완료' : '미확인 시 위험'}
            </div>
            <p style={{
              fontSize: 15, fontWeight: 600, lineHeight: 1.75, wordBreak: 'keep-all',
              color: isDone ? accent : '#222',
            }}>
              {isDone ? check.whyItMatters : check.consequence}
            </p>
          </div>

          {/* 계산기 */}
          {calcRenderer && (
            <div style={{ padding: '14px 16px', borderBottom: `1px dashed ${cardBorder}` }}>
              <div style={{
                fontSize: 10, fontWeight: 900, color: '#009688', letterSpacing: '0.12em',
                textTransform: 'uppercase', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>계산</span>
                {isSkipped && (
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#888', background: '#F0F0F0', borderRadius: 4, padding: '3px 8px', letterSpacing: 0 }}>
                    정보 없이 건너뜀
                  </span>
                )}
              </div>
              {calcRenderer(calcProps)}
              <button
                onClick={e => { e.stopPropagation(); onToggleSkip(check.id); }}
                style={{
                  marginTop: 10, width: '100%', padding: '9px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  border: `1.5px solid ${isSkipped ? '#009688' : '#E0E0E0'}`,
                  background: isSkipped ? '#F0FAFA' : '#fff',
                  color: isSkipped ? '#009688' : '#888', cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {isSkipped ? '다시 입력하기' : '정보 없이 건너뛰고 확인 완료'}
              </button>
            </div>
          )}

          {/* 할 일 */}
          <div style={{ padding: '16px 18px' }}>
            <div style={{
              fontSize: 10, fontWeight: 900, color: '#111', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 12,
            }}>
              지금 할 일
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {check.externalLink && (
                <a
                  href={check.externalLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: '2px solid #111', borderRadius: 6, padding: '12px 14px',
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
                  <div style={{ width: 32, height: 32, background: '#111', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: '#111', color: '#fff', fontSize: 11, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i + 1}
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleAction(i); }} aria-label="할 일 완료 체크" style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      border: adone ? 'none' : '2px solid #CFCFCF', cursor: 'pointer',
                      background: adone ? '#009688' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {adone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                    <div style={{ flex: 1 }}>
                      {adone && (
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#009688', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
                          완료
                        </div>
                      )}
                      <p style={{ fontSize: 14, fontWeight: 600, color: adone ? '#009688' : '#111', lineHeight: 1.65, transition: 'all .15s' }}>
                        {adone ? a.why : a.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 대주제 완료 버튼 */}
            <button
              onClick={e => {
                e.stopPropagation();
                const allActions = new Set(check.actions.map((_, i) => i));
                setActionsDone(isDone ? new Set() : allActions);
                onToggle(check.id);
              }}
              style={{
                marginTop: 16, width: '100%', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 900,
                border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: isDone ? 'rgba(0,0,0,0.06)' : accent,
                color: isDone ? accent : '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {isDone ? '확인 취소' : '이 항목 확인 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 부록 (접이식) ────────────────────────────────────────── */
function AppendixSection({ result }: { result: RentAnalysisResult | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #E8E8E8' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: '#FAFAFA', border: 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>
          부록 — 질문·특약·용어 정리
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && (
        <div style={{ background: '#fff' }}>
          <GuideToolsBar result={result} />
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
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [activeStep, setActiveStep]  = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleOpen = useCallback((id: string) => {
    setOpenCardId(prev => prev === id ? null : id);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StepBar confirmedIds={confirmed} activeStep={activeStep} onSelect={scrollToStep} />

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 60px' }}>
        {STEP_NAMES.map((name, si) => (
          <div key={si} id={`guide-step-${si}`} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              paddingBottom: 8, borderBottom: '1.5px solid #111',
            }}>
              <div style={{
                width: 26, height: 26, background: '#111', borderRadius: 4, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{si + 1}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#111' }}>{name}</span>
              <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto', fontWeight: 700 }}>
                {CHECKS_BY_STEP[si].filter(c => confirmed.has(c.id)).length}/{CHECKS_BY_STEP[si].length}
              </span>
            </div>
            {CHECKS_BY_STEP[si].map(check => (
              <CheckCard
                key={check.id}
                check={check}
                confirmed={confirmed}
                onToggle={onToggle}
                skipped={skipped}
                onToggleSkip={onToggleSkip}
                calcProps={calcProps}
                open={openCardId === check.id}
                onOpen={() => handleOpen(check.id)}
              />
            ))}
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '8px 0 28px' }}>
          <button onClick={onResult} style={{
            padding: '14px 36px', background: '#009688', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 900,
            cursor: 'pointer', letterSpacing: '-0.01em',
          }}>
            분석 결과 보기
          </button>
        </div>

        <AppendixSection result={analysisResult} />
      </div>
    </div>
  );
}
