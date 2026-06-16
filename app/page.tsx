'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FormData, RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { currentYearMonth } from '@/lib/dateUtils';
import { fetchRentAnalysis } from '@/lib/rentApi';
import StartScreen from '@/components/StartScreen';
import RiskResultCard from '@/components/RiskResultCard';
import GuideView from '@/components/GuideView';
import { CHECKS_BY_STEP } from '@/lib/checkData';

type Phase = 'start' | 'guide' | 'result';

const DEFAULT_FORM: FormData = {
  address: '',
  lawdCd: null,
  bjdongCd: null,
  dongName: null,
  pnu:                  null,
  area:                 null,
  buildingName:         '',
  priorTenantDeposit:   null,
  floor:                null,
  propertyType: 'apartment',
  deposit: null,
  monthlyRent: null,
  dealYm: currentYearMonth(),
  housePrice: null,
  mortgageAmount: null,
  hasMortgage: null,
  hasPriorLiens: null,
  isOwnerMatch: null,
  canRegister: null,
  canGetFixedDate: null,
  canInsure: null,
};

export default function Page() {
  const [phase, setPhase]           = useState<Phase>('start');
  const [form, setForm]             = useState<FormData>(DEFAULT_FORM);
  const [result, setResult]         = useState<RentAnalysisResult | null>(null);
  const [status, setStatus]         = useState<AnalysisStatus>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback(async (f: FormData) => {
    if (!f.lawdCd || !f.deposit || !f.dealYm) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetchRentAnalysis(f);
      setResult(res);
      setStatus(res.status === 'noData' ? 'noData' : 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      if (msg === 'MISSING_REQUIRED') { setStatus('idle'); }
      else { setStatus('error'); setErrorMsg(msg); }
    }
  }, []);

  const handleFormChange = useCallback((next: FormData) => {
    setForm(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.lawdCd || !next.deposit || !next.dealYm) { setStatus('idle'); return; }
    debounceRef.current = setTimeout(() => runAnalysis(next), 500);
  }, [runAnalysis]);

  useEffect(() => {
    try {
      const s = localStorage.getItem('kyeyak_checks');
      if (s) setCheckedIds(new Set(JSON.parse(s)));
      const sk = localStorage.getItem('kyeyak_skipped');
      if (sk) setSkippedIds(new Set(JSON.parse(sk)));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('kyeyak_checks', JSON.stringify([...checkedIds])); }
    catch {}
  }, [checkedIds]);

  useEffect(() => {
    try { localStorage.setItem('kyeyak_skipped', JSON.stringify([...skippedIds])); }
    catch {}
  }, [skippedIds]);

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    // 수동으로 체크를 떼면 '건너뜀' 표시도 함께 해제
    setSkippedIds(prev => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  // 추가정보·계산이 필요한 항목의 예외적인 '건너뛰기' — 정보 없이도 확인 완료로 처리
  const toggleSkip = (id: string) => {
    const willSkip = !skippedIds.has(id);
    setSkippedIds(prev => {
      const n = new Set(prev);
      willSkip ? n.add(id) : n.delete(id);
      return n;
    });
    setCheckedIds(prev => {
      const n = new Set(prev);
      willSkip ? n.add(id) : n.delete(id);
      return n;
    });
  };

  const resetAll = () => {
    setPhase('start'); setForm(DEFAULT_FORM); setResult(null); setStatus('idle'); setErrorMsg('');
  };

  if (phase === 'start') return <StartScreen onStart={() => setPhase('guide')} />;

  const totalChecks = CHECKS_BY_STEP.flat().length;
  const donePct = totalChecks > 0 ? Math.round((checkedIds.size / totalChecks) * 100) : 0;

  const [displayPct, setDisplayPct] = useState(donePct);
  const animRef = useRef<number | null>(null);
  const prevPctRef = useRef(donePct);
  useEffect(() => {
    const from = prevPctRef.current;
    const to = donePct;
    prevPctRef.current = to;
    if (from === to) return;
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const duration = 500;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplayPct(Math.round(from + (to - from) * eased));
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [donePct]);

  const AppHeader = () => (
    <header style={{ background: '#111', color: '#fff', padding: '14px 20px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}>계약 전 확인 진행률</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{checkedIds.size} / {totalChecks} 항목</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${donePct}%`, background: '#009688', borderRadius: 6, transition: 'width .5s ease' }} />
          </div>
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, color: donePct > 0 ? '#5EEAD4' : 'rgba(255,255,255,0.25)', letterSpacing: '-0.03em', flexShrink: 0, lineHeight: 1, minWidth: 64, textAlign: 'right' }}>
          {displayPct}%
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {phase === 'result' && (
          <button onClick={() => setPhase('guide')} style={{ fontSize: 11, fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '5px 12px', borderRadius: 4, background: 'none', cursor: 'pointer' }}>체크리스트로</button>
        )}
        <button onClick={resetAll} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', border: 'none', padding: '5px 4px', background: 'none', cursor: 'pointer' }}>처음부터</button>
      </div>
    </header>
  );

  /* ── 가이드 뷰 (HTML 파일과 동일한 레이아웃) ────────────── */
  if (phase === 'guide') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <GuideView
            confirmed={checkedIds}
            onToggle={toggleCheck}
            onResult={() => setPhase('result')}
            skipped={skippedIds}
            onToggleSkip={toggleSkip}
            form={form}
            onFormChange={handleFormChange}
            analysisResult={result}
            analysisStatus={status}
            onRunAnalysis={runAnalysis}
          />
        </div>
      </div>
    );
  }

  /* ── 분석 결과 뷰 ──────────────────────────────────────── */
  if (phase === 'result') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader />
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 48px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          <RiskResultCard result={result} status={status} errorMessage={errorMsg} checkedCount={checkedIds.size} totalChecks={totalChecks} onBackToGuide={() => setPhase('guide')} />
          <p style={{ textAlign: 'center', fontSize: 11, color: '#888', lineHeight: 1.8, marginTop: 24 }}>
            이 서비스는 계약 전 위험 신호를 조기에 발견하기 위한 진단 도구입니다.<br />
            전세사기 여부를 단정하거나 법적 판단을 제공하지 않습니다.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
