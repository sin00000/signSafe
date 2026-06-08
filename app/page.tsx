'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FormData, RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { currentYearMonth } from '@/lib/dateUtils';
import { fetchRentAnalysis } from '@/lib/rentApi';
import StartScreen from '@/components/StartScreen';
import RiskResultCard from '@/components/RiskResultCard';
import GuideToolsBar from '@/components/GuideToolsBar';
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

  /* ── 공통 헤더 — 타이틀 대신 진행률 지표 표시, 로고를 누르면 처음부터 ── */
  const totalChecks = CHECKS_BY_STEP.flat().length;
  const donePct = totalChecks > 0 ? Math.round((checkedIds.size / totalChecks) * 100) : 0;
  const AppHeader = () => (
    <header className="bg-[#111] text-white h-[56px] flex-shrink-0 px-5 flex items-center gap-4">
      {/* 진행률 지표 — 얼마나 해결되었는지 */}
      <div className="flex-1 max-w-[360px]">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-black tracking-tight text-white/90">계약 전 확인 진행률</span>
          <span className="text-[12px] font-black text-[#5EEAD4]">{checkedIds.size} / {totalChecks} · {donePct}%</span>
        </div>
        <div className="h-[5px] bg-white/15 rounded-full overflow-hidden">
          <div className="h-full bg-[#009688] rounded-full transition-[width] duration-500" style={{ width: `${donePct}%` }} />
        </div>
      </div>

      {phase === 'result' && (
        <button onClick={() => setPhase('guide')} className="text-[11px] font-bold text-white border border-white/30 px-3 py-1.5 rounded flex-shrink-0">← 체크리스트로</button>
      )}
      <button onClick={resetAll} className="text-[11px] font-bold text-white/70 hover:text-white px-2 py-1.5 rounded flex-shrink-0 transition-colors">처음부터</button>
    </header>
  );

  /* ── 가이드 뷰 (HTML 파일과 동일한 레이아웃) ────────────── */
  if (phase === 'guide') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader />
        <div style={{ padding: '10px 16px 0', maxWidth: 680, margin: '0 auto', width: '100%', flexShrink: 0 }}>
          <GuideToolsBar result={result} />
        </div>
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
