'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FormData, RentAnalysisResult, AnalysisStatus, RiskLevel } from '@/types/rent';
import { formatWon } from '@/lib/formatMoney';
import { currentYearMonth } from '@/lib/dateUtils';
import { fetchRentAnalysis } from '@/lib/rentApi';
import RiskResultCard from '@/components/RiskResultCard';
import GuideView from '@/components/GuideView';
import { CHECKS_BY_STEP } from '@/lib/checkData';
import { RiskSignMini } from '@/components/SignFrame';

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

// 분석 결과 있으면 그 레벨, 없으면 체크 진행률로 실시간 판별
function liveRiskLevel(
  result: RentAnalysisResult | null,
  status: AnalysisStatus,
  checkedCount: number,
  totalChecks: number,
): RiskLevel {
  if (result && (status === 'success' || status === 'noData')) return result.riskLevel;
  if (checkedCount === 0) return 'gray';
  const pct = (checkedCount / totalChecks) * 100;
  if (pct < 40) return 'red';
  if (pct < 80) return 'yellow';
  return 'blue';
}

interface AppHeaderProps {
  result: RentAnalysisResult | null;
  status: AnalysisStatus;
  currentLevel: RiskLevel;
  phase: Phase;
  onGoToGuide: () => void;
  onReset: () => void;
}

function AppHeader({ result, status, currentLevel, phase, onGoToGuide, onReset }: AppHeaderProps) {
  const hasResult = result && status === 'success';
  const refMedian = hasResult
    ? (result.jeonseCount >= 3 ? result.medianJeonseDeposit : result.medianAllDeposit)
    : null;

  return (
    <header style={{ background: '#111', color: '#fff', padding: '11px 16px 10px', flexShrink: 0 }}>
      {/* 상단 행: 앱 이름 | 위험도 표지판 + 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>계약전야</span>
        <RiskSignMini level={currentLevel} />
        <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
          {phase === 'result' && (
            <button onClick={onGoToGuide} style={{ fontSize: 11, fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 10px', borderRadius: 4, background: 'none', cursor: 'pointer' }}>체크리스트로</button>
          )}
          <button onClick={onReset} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', border: 'none', padding: '4px 0', background: 'none', cursor: 'pointer' }}>처음부터</button>
        </div>
      </div>

      {/* 하단 행: 분석 수치 chips (분석 완료 시에만) */}
      {hasResult && (
        <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {result.depositRatio != null && (
            <span style={{
              fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.07)',
              color: result.depositRatio >= 130 ? '#FF8080' : result.depositRatio >= 110 ? '#FFD43B' : '#5EEAD4',
            }}>
              시세 대비 {result.depositRatio}%
            </span>
          )}
          {result.jeonseRate != null && (
            <span style={{
              fontSize: 11, fontWeight: 900, padding: '3px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.07)',
              color: result.jeonseRate >= 80 ? '#FF8080' : result.jeonseRate >= 70 ? '#FFD43B' : '#5EEAD4',
            }}>
              전세가율 {result.jeonseRate}%
            </span>
          )}
          {refMedian != null && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              시세 중앙값 {formatWon(refMedian)}
            </span>
          )}
          {result.jeonseCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
              전세 {result.jeonseCount}건
            </span>
          )}
        </div>
      )}
      {status === 'loading' && (
        <div style={{ marginTop: 7, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>실거래가 조회 중…</div>
      )}
    </header>
  );
}

export default function Page() {
  const [phase, setPhase]           = useState<Phase>('guide');
  const [form, setForm]             = useState<FormData>(DEFAULT_FORM);
  const [result, setResult]         = useState<RentAnalysisResult | null>(null);
  const [status, setStatus]         = useState<AnalysisStatus>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const n = new Set(prev); n.delete(id); return n;
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

  const totalChecks  = CHECKS_BY_STEP.flat().length;
  const currentLevel = liveRiskLevel(result, status, checkedIds.size, totalChecks);

  const headerProps: AppHeaderProps = {
    result,
    status,
    currentLevel,
    phase,
    onGoToGuide: () => setPhase('guide'),
    onReset: resetAll,
  };

  if (phase === 'guide') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader {...headerProps} />
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
      <AppHeader {...headerProps} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 48px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <RiskResultCard result={result} status={status} errorMessage={errorMsg} checkedIds={checkedIds} totalChecks={totalChecks} onBackToGuide={() => setPhase('guide')} />
        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', lineHeight: 1.8, marginTop: 28 }}>
          이 서비스는 계약 전 위험 신호를 조기에 발견하기 위한 진단 도구입니다.<br />
          전세사기 여부를 단정하거나 법적 판단을 제공하지 않습니다.
        </p>
      </div>
    </div>
  );
}
