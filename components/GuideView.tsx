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

const GREEN = '#009688';
const GREEN_LIGHT = '#EDFAF7';
const GREEN_BORDER = '#B2DFDB';

/* ── 히어로 / 랜딩 섹션 ───────────────────────────────────── */
function HeroSection() {
  return (
    <div style={{ padding: '36px 0 32px', borderBottom: '2px solid #111' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        계약전야 · 전세 계약 내비게이션
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: 16, wordBreak: 'keep-all' }}>
        처음으로 집 살 때<br />사기 안당하는<br />체크리스트
      </h1>
      <p style={{ fontSize: 14, color: '#444', lineHeight: 1.75, marginBottom: 20, wordBreak: 'keep-all' }}>
        전세 계약 전 꼭 확인해야 할 항목을 7단계 21개로 정리했습니다.<br />
        처음 집을 구하는 분도 빠짐없이 확인할 수 있도록 만들었습니다.
      </p>

      {/* 누구를 위한 건지 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {[
          '처음으로 전세 계약을 하는 분',
          '전세사기가 걱정되는 분',
          '계약 전 빠진 게 없는지 확인하고 싶은 분',
        ].map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* 신뢰 컨텍스트 */}
      <div style={{ background: '#F7F7F7', borderRadius: 8, padding: '12px 14px', marginBottom: 20, borderLeft: `3px solid ${GREEN}` }}>
        <p style={{ fontSize: 12, color: '#555', lineHeight: 1.7, margin: 0 }}>
          현직 공인중개사와 함께 검토한 항목입니다. 실제 전세사기 패턴을 분석해 선별했으며, 국토교통부 실거래가 데이터로 시세를 직접 비교합니다.
        </p>
      </div>

    </div>
  );
}

/* ── 가로 스텝 바 ─────────────────────────────────────────── */
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
                background: done ? GREEN : partial ? '#333' : '#DEDEDE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done
                  ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : <span style={{ fontSize: 8, fontWeight: 900, color: partial ? '#fff' : '#999' }}>{si + 1}</span>
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

  const isDone      = confirmed.has(check.id);
  const isSkipped   = isDone && skipped.has(check.id);
  const isDanger    = check.risk === 'danger';
  const calcRenderer = CALC_RENDERERS[check.id];

  const cardBg     = isDone ? '#F5F5F5' : '#fff';
  const cardBorder = isDone ? '#D0D0D0' : '#E0E0E0';
  const textColor  = isDone ? '#999' : '#111';

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
      marginBottom: 7, background: cardBg, borderRadius: 10, overflow: 'hidden',
      border: `1.5px solid ${cardBorder}`,
      boxShadow: open ? '0 2px 10px rgba(0,0,0,0.06)' : 'none', transition: 'box-shadow .15s',
    }}>
      {/* 접힌 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 60, userSelect: 'none' }}>
        {/* 체크 버튼 */}
        <button
          onClick={e => {
            e.stopPropagation();
            const allActions = new Set(check.actions.map((_, i) => i));
            setActionsDone(isDone ? new Set() : allActions);
            onToggle(check.id);
          }}
          aria-label="완료 체크"
          style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            border: isDone ? 'none' : `2px solid #BDBDBD`,
            background: isDone ? '#BDBDBD' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s', padding: 0,
          }}
        >
          {isDone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
        </button>

        {/* 제목 */}
        <span onClick={onOpen} style={{
          flex: 1, fontSize: 16, fontWeight: 800, color: textColor,
          wordBreak: 'keep-all', lineHeight: 1.3, cursor: 'pointer',
        }}>
          {check.q}
        </span>

        {/* 뱃지 영역 */}
        {!isDone && isDanger && (
          <span style={{ fontSize: 10, fontWeight: 900, background: '#111', color: '#fff', padding: '3px 7px', borderRadius: 3, flexShrink: 0 }}>
            필수
          </span>
        )}
        {!isDone && !isDanger && (
          <button
            onClick={e => { e.stopPropagation(); onToggle(check.id); }}
            style={{ fontSize: 10, fontWeight: 700, border: '1px solid #BDBDBD', color: '#777', padding: '3px 7px', borderRadius: 3, background: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            유의
          </button>
        )}
        {isDone && isSkipped && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#999', border: '1px solid #D0D0D0', padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>
            건너뜀
          </span>
        )}

        <svg onClick={onOpen} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, cursor: 'pointer' }}>
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </div>

      {/* 펼친 내용 */}
      {open && (
        <div style={{ borderTop: '1px solid #E8E8E8' }}>

          {/* 결과 설명 */}
          <div style={{ padding: '14px 18px', borderBottom: '1px dashed #E8E8E8', background: isDone ? '#F5F5F5' : '#FAFAFA' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>
              미확인 시 위험
            </div>
            <p style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.7, wordBreak: 'keep-all', color: '#222', marginBottom: check.whyItMatters ? 10 : 0 }}>
              {check.consequence}
            </p>
            {check.whyItMatters && (
              <>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', marginBottom: 6, marginTop: 2 }}>
                  이 항목을 해야 하는 이유
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.7, wordBreak: 'keep-all', color: '#555' }}>
                  {check.whyItMatters}
                </p>
              </>
            )}
          </div>

          {/* 계산기 */}
          {calcRenderer && (
            <div style={{ padding: '14px 16px', borderBottom: '1px dashed #E8E8E8' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: GREEN, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>계산</span>
                {isSkipped && (
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#888', background: '#F0F0F0', borderRadius: 4, padding: '3px 8px', letterSpacing: 0 }}>정보 없이 건너뜀</span>
                )}
              </div>
              {calcRenderer(calcProps)}
            </div>
          )}

          {/* 할 일 */}
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#111', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
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
                    <button onClick={e => { e.stopPropagation(); toggleAction(i); }} aria-label="할 일 완료 체크" style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      border: adone ? 'none' : '2px solid #CFCFCF', cursor: 'pointer',
                      background: adone ? '#BDBDBD' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {adone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: adone ? '#888' : '#111', lineHeight: 1.65, transition: 'all .15s' }}>
                        {a.text}
                      </p>
                      {adone && (
                        <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, marginTop: 5, paddingTop: 5, borderTop: '1px dashed #D0D0D0' }}>
                          {a.why}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={e => {
                e.stopPropagation();
                const allActions = new Set(check.actions.map((_, i) => i));
                setActionsDone(isDone ? new Set() : allActions);
                onToggle(check.id);
              }}
              style={{
                marginTop: 16, width: '100%', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 900,
                border: isDone ? '1.5px solid #D0D0D0' : 'none',
                cursor: 'pointer', transition: 'all .15s',
                background: isDone ? '#EFEFEF' : GREEN,
                color: isDone ? '#888' : '#fff',
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
        <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>부록 — 질문·특약·용어 정리</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && <div style={{ background: '#fff' }}><GuideToolsBar result={result} /></div>}
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

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 14px 60px' }}>

        {/* 랜딩 섹션 */}
        <HeroSection />

        {/* 체크리스트 */}
        <div style={{ paddingTop: 24 }}>
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
              padding: '14px 36px', background: GREEN, color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 900,
              cursor: 'pointer', letterSpacing: '-0.01em',
            }}>
              분석 결과 보기
            </button>
          </div>

          <AppendixSection result={analysisResult} />
        </div>
      </div>
    </div>
  );
}
