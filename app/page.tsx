'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FormData, RentAnalysisResult, AnalysisStatus, RiskLevel } from '@/types/rent';
import { currentYearMonth } from '@/lib/dateUtils';
import { fetchRentAnalysis } from '@/lib/rentApi';
import RiskResultCard from '@/components/RiskResultCard';
import GuideView from '@/components/GuideView';
import { CHECKS_BY_STEP } from '@/lib/checkData';

type Phase = 'guide' | 'result';

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

const LEVEL_INFO: Record<string, { label: string; color: string }> = {
  red:    { label: '위험', color: '#FF8080' },
  yellow: { label: '주의', color: '#FFD43B' },
  blue:   { label: '안전', color: '#5EEAD4' },
};

function liveRiskLevel(
  result: RentAnalysisResult | null,
  status: AnalysisStatus,
  checkedCount: number,
  totalChecks: number,
): RiskLevel {
  if (result && status === 'success') return result.riskLevel;
  const pct = totalChecks > 0 ? (checkedCount / totalChecks) * 100 : 0;
  if (checkedCount === 0) return 'gray';
  if (pct < 40) return 'red';
  if (pct < 80) return 'yellow';
  return 'blue';
}

export default function Page() {
  const [phase, setPhase]           = useState<Phase>('guide');
  const [form, setForm]             = useState<FormData>(DEFAULT_FORM);
  const [result, setResult]         = useState<RentAnalysisResult | null>(null);
  const [status, setStatus]         = useState<AnalysisStatus>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCheckedRef = useRef<Set<string>>(new Set());

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

  // 계산 결과가 나오면 해당 카드 자동 체크
  useEffect(() => {
    const toAdd: string[] = [];
    const ac = autoCheckedRef.current;
    if ((status === 'success' || status === 'noData') && !ac.has('s2i0'))
      { toAdd.push('s2i0'); ac.add('s2i0'); }
    if (form.deposit && form.housePrice && !ac.has('s2i1'))
      { toAdd.push('s2i1'); ac.add('s2i1'); }
    if (form.housePrice && !ac.has('s2i2'))
      { toAdd.push('s2i2'); ac.add('s2i2'); }
    if (form.mortgageAmount != null && form.deposit && form.housePrice && !ac.has('s3i1'))
      { toAdd.push('s3i1'); ac.add('s3i1'); }
    if (toAdd.length > 0) {
      setCheckedIds(prev => {
        const n = new Set(prev);
        toAdd.forEach(id => n.add(id));
        return n;
      });
    }
  }, [status, form.deposit, form.housePrice, form.mortgageAmount]);

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setSkippedIds(prev => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const toggleSkip = (id: string) => {
    const willSkip = !skippedIds.has(id);
    setSkippedIds(prev => { const n = new Set(prev); willSkip ? n.add(id) : n.delete(id); return n; });
    setCheckedIds(prev => { const n = new Set(prev); willSkip ? n.add(id) : n.delete(id); return n; });
  };

  const resetAll = () => {
    setPhase('guide');
    setForm(DEFAULT_FORM);
    setResult(null);
    setStatus('idle');
    setErrorMsg('');
    setCheckedIds(new Set());
    setSkippedIds(new Set());
    autoCheckedRef.current = new Set();
  };

  const totalChecks = CHECKS_BY_STEP.flat().length;
  const donePct = totalChecks > 0 ? Math.round((checkedIds.size / totalChecks) * 100) : 0;
  const currentLevel = liveRiskLevel(result, status, checkedIds.size, totalChecks);

  const AppHeader = () => (
    <header style={{ background: '#111', color: '#fff', padding: '14px 20px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}>계약 전 확인 진행률</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{checkedIds.size} / {totalChecks} 항목</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${donePct}%`, background: '#009688', borderRadius: 6, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </div>
        </div>

        {/* 4단 위험도 실시간 표시 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em' }}>위험도</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {(['red', 'yellow', 'blue'] as const).map(lvl => (
              <span key={lvl} style={{
                fontSize: 11, fontWeight: 900, padding: '3px 7px', borderRadius: 3,
                transition: 'all 0.5s ease',
                background: currentLevel === lvl ? LEVEL_INFO[lvl].color : 'rgba(255,255,255,0.07)',
                color: currentLevel === lvl ? '#111' : 'rgba(255,255,255,0.18)',
              }}>
                {LEVEL_INFO[lvl].label}
              </span>
            ))}
          </div>
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
