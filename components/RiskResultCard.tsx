'use client';
import React, { useState } from 'react';
import { RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { RiskSign } from './SignFrame';
import { formatWon } from '@/lib/formatMoney';
import { formatYm } from '@/lib/dateUtils';

interface Props {
  result: RentAnalysisResult | null;
  status: AnalysisStatus;
  errorMessage?: string;
  checkedCount?: number;
  totalChecks?: number;
  onBackToGuide?: () => void;
}

const RISK_SIGN_LABELS: Record<string, string> = {
  red: '위험', yellow: '주의', blue: '안전', gray: '자료 부족',
};

function fallbackSignalFromChecks(checkedCount: number, totalChecks: number): {
  level: 'red' | 'yellow' | 'blue' | 'gray'; pct: number; title: string; message: string;
} {
  const pct = totalChecks > 0 ? Math.round((checkedCount / totalChecks) * 100) : 0;
  if (checkedCount === 0) {
    return { level: 'gray', pct, title: '아직 체크리스트를 시작하지 않았어요',
      message: '체크리스트 항목을 하나씩 확인하면, 입력한 정보가 없어도 지금까지 확인한 개수를 기준으로 신호등이 표시됩니다.' };
  }
  if (pct < 40) {
    return { level: 'red', pct, title: '아직 확인한 항목이 많지 않아요',
      message: `전체 ${totalChecks}개 중 ${checkedCount}개만 확인했습니다. 핵심 위험 항목(등기부등본·근저당·전세가율 등)을 먼저 확인해 보세요.` };
  }
  if (pct < 80) {
    return { level: 'yellow', pct, title: '절반 정도 확인했어요 — 계속 진행하세요',
      message: `전체 ${totalChecks}개 중 ${checkedCount}개를 확인했습니다. 남은 항목을 마저 확인하면 더 정확한 분석을 받을 수 있어요.` };
  }
  return { level: 'blue', pct, title: '체크리스트를 거의 다 확인했어요',
    message: `전체 ${totalChecks}개 중 ${checkedCount}개(${pct}%)를 확인했습니다. 주소·보증금·집값을 입력하면 수치 기반의 정밀 분석도 함께 받을 수 있어요.` };
}

/* ── 안전 근거 생성 ─────────────────────────── */
interface SafePoint { text: string; detail: string }

function buildSafePoints(r: RentAnalysisResult): SafePoint[] {
  const pts: SafePoint[] = [];
  const refMedian = r.jeonseCount >= 3 ? r.medianJeonseDeposit : r.medianAllDeposit;

  if (r.depositRatio !== null && refMedian !== null) {
    const diff = 100 - r.depositRatio;
    if (diff >= 10) {
      pts.push({
        text: `주변 전세 시세보다 ${diff}% 낮은 보증금`,
        detail: `주변 전세 거래 중앙값은 ${formatWon(refMedian)}입니다. 내 보증금(${formatWon(r.userDeposit)})은 이보다 ${diff}% 낮아 집값 하락 시에도 회수 가능성이 높습니다.`,
      });
    } else if (r.depositRatio <= 100) {
      pts.push({
        text: '주변 시세와 비슷한 보증금 수준',
        detail: `주변 전세 시세 중앙값(${formatWon(refMedian)})과 내 보증금(${formatWon(r.userDeposit)})이 거의 같은 수준입니다. 과도하게 높지 않습니다.`,
      });
    } else {
      pts.push({
        text: `주변 시세 대비 ${r.depositRatio - 100}% 높지만 주의 기준(10%) 이내`,
        detail: `주변 전세 시세 중앙값 대비 ${r.depositRatio}% 수준입니다. 10% 초과 시 주의 신호가 뜨지만 현재는 그 기준을 넘지 않습니다.`,
      });
    }
  }

  if (r.jeonseRate !== null) {
    if (r.jeonseRate < 60) {
      pts.push({
        text: `전세가율 ${r.jeonseRate}% — 집값의 절반 수준`,
        detail: `보증금이 집값의 ${r.jeonseRate}%입니다. 집값이 ${100 - r.jeonseRate}% 넘게 하락하지 않는 한 보증금 전액 회수 가능성이 높습니다. 경매 낙찰가율을 감안해도 안전 범위입니다.`,
      });
    } else if (r.jeonseRate < 70) {
      pts.push({
        text: `전세가율 ${r.jeonseRate}% — 안전 권고 기준(70%) 이하`,
        detail: `보증금이 집값의 ${r.jeonseRate}%입니다. HUG·HF 전세보증보험 가입 가능 기준(100%)과 일반 안전 권고 기준(70%) 모두 충족합니다.`,
      });
    }
  }

  if (r.riskFactors.length === 0) {
    pts.push({
      text: '입력하신 정보 기준 별도의 위험 요소 없음',
      detail: '집값·대출(근저당)·소유자 일치 여부·보증보험 가능 여부 등 입력하신 정보에서 위험 신호가 발견되지 않았습니다. 단, 입력하지 않은 항목은 분석되지 않았습니다.',
    });
  }

  if (r.jeonseCount >= 5) {
    pts.push({
      text: `비교 데이터 ${r.jeonseCount}건 — 시세 신뢰도 높음`,
      detail: `이 분석에 사용된 전세 실거래 건수는 ${r.jeonseCount}건입니다. 표본이 충분해 중앙값의 신뢰도가 높습니다.`,
    });
  }

  return pts;
}

/* ── 컴포넌트들 ─────────────────────────────── */
function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded p-3 border ${highlight ? 'border-[#CC1100] bg-[#FFF5F5]' : 'border-[#E0E0E0] bg-white'}`}>
      <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-lg font-black leading-tight ${highlight ? 'text-[#CC1100]' : 'text-[#111]'}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#888] mt-0.5">{sub}</div>}
    </div>
  );
}

function SafePointCard({ point }: { point: SafePoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#EDFAF7', border: '1.5px solid #B2DFDB', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#009688', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#1a4a45', lineHeight: 1.4 }}>{point.text}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#009688" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && (
        <p style={{ fontSize: 12, color: '#334', lineHeight: 1.75, padding: '2px 14px 12px 32px', margin: 0 }}>{point.detail}</p>
      )}
    </div>
  );
}

function RiskFactorCard({ factor }: { factor: { level: string; title: string; description: string; action: string } }) {
  const [open, setOpen] = useState(false);
  const color = factor.level === 'red' ? '#CC1100' : factor.level === 'yellow' ? '#E6A000' : '#009688';
  const bg    = factor.level === 'red' ? '#FFF5F5' : factor.level === 'yellow' ? '#FFFBF0' : '#F0FAFA';

  return (
    <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: color }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: bg }}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="flex-1 text-[13px] font-black text-[#111] leading-snug">{factor.title}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t" style={{ borderColor: color + '44', background: '#fff' }}>
          <p className="text-[13px] text-[#444] leading-relaxed mb-4">{factor.description}</p>
          <div style={{ background: color + '11', borderRadius: 6, padding: '10px 12px' }}>
            <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color }}>지금 해야 할 일</div>
            <p className="text-[13px] font-bold text-[#111] leading-relaxed">{factor.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 메인 컴포넌트 ──────────────────────────── */
export default function RiskResultCard({ result, status, errorMessage, checkedCount = 0, totalChecks = 0, onBackToGuide }: Props) {
  if (status === 'loading') {
    return (
      <div className="bg-white border-2 border-[#E0E0E0] rounded-xl p-8 text-center">
        <div className="w-10 h-10 border-4 border-[#009688] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-bold text-[#555]">국토교통부 실거래가 조회 중…</p>
        <p className="text-[11px] text-[#888] mt-1">최근 4개월 데이터를 분석합니다.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-[#FFF5F5] border-2 border-[#CC1100] rounded-xl p-5">
        <p className="text-sm font-bold text-[#CC1100] mb-1">실거래가 조회에 실패했습니다.</p>
        <p className="text-[12px] text-[#CC1100]">{errorMessage || '잠시 후 다시 시도하거나 API 키를 확인해주세요.'}</p>
      </div>
    );
  }

  if (status === 'idle' || !result) {
    const fb = fallbackSignalFromChecks(checkedCount, totalChecks);
    const fbColors = {
      red:    { border: '#CC1100', bg: '#FFF5F5' },
      yellow: { border: '#E6A000', bg: '#FFFBF0' },
      blue:   { border: '#009688', bg: '#F0FAFA' },
      gray:   { border: '#888',    bg: '#F5F5F5' },
    }[fb.level];

    return (
      <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: fbColors.border }}>
        <div className="p-5 flex gap-5 items-start" style={{ background: fbColors.bg, borderBottom: `2px solid ${fbColors.border}` }}>
          <RiskSign level={fb.level} label={RISK_SIGN_LABELS[fb.level]} />
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#888] mb-1.5">체크리스트 기준 임시 신호 · 수치 입력 전</div>
            <h2 className="text-[15px] font-black text-[#111] leading-tight mb-2">{fb.title}</h2>
            <p className="text-[12px] text-[#555] leading-relaxed">{fb.message}</p>
            <div className="h-[6px] bg-white/70 rounded-full overflow-hidden mt-3 border border-[#E0E0E0]">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${fb.pct}%`, background: fbColors.border }} />
            </div>
            <p className="text-[11px] text-[#888] mt-1.5">{checkedCount} / {totalChecks}개 확인 · {fb.pct}%</p>
          </div>
        </div>
        <div className="p-5 text-center bg-white">
          <p className="text-[12px] text-[#888] leading-relaxed mb-4">
            체크리스트의 <b className="text-[#333]">"주변 시세와 비교하기"</b> 카드에서<br />
            주소·보증금·계약월(그리고 집값)을 입력하면<br />
            실거래가 데이터를 반영한 정밀 분석으로 자동으로 바뀝니다.
          </p>
          {onBackToGuide && (
            <button
              onClick={onBackToGuide}
              className="text-[12px] font-bold text-white bg-[#009688] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              체크리스트로 가서 정보 입력하기 →
            </button>
          )}
        </div>
      </div>
    );
  }

  const riskColors: Record<string, { border: string; bg: string }> = {
    blue:   { border: '#009688', bg: '#EDFAF7' },
    yellow: { border: '#E6A000', bg: '#FFFBF0' },
    red:    { border: '#CC1100', bg: '#FFF5F5' },
    gray:   { border: '#888',    bg: '#F5F5F5' },
  };
  const { border, bg } = riskColors[result.riskLevel] ?? riskColors.gray;
  const isSafe = result.riskLevel === 'blue';
  const safePoints = isSafe ? buildSafePoints(result) : [];
  const refMedian = result.jeonseCount >= 3 ? result.medianJeonseDeposit : result.medianAllDeposit;

  return (
    <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: border }}>

      {/* 헤더 */}
      <div className="p-5 flex gap-5 items-start" style={{ background: bg, borderBottom: `2px solid ${border}` }}>
        <RiskSign level={result.riskLevel as 'blue' | 'yellow' | 'red' | 'gray'} label={RISK_SIGN_LABELS[result.riskLevel]} />
        <div className="flex-1">
          <h2 className="text-[16px] font-black text-[#111] leading-tight mb-2">{result.riskTitle}</h2>
          <p className="text-[12px] text-[#555] leading-relaxed">{result.riskMessage}</p>
        </div>
      </div>

      {/* 안전 근거 (blue 전용) */}
      {isSafe && safePoints.length > 0 && (
        <div className="p-4 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-black text-white rounded px-1.5 py-[1px]" style={{ background: border }}>✓</span>
            <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">안전하다고 볼 수 있는 근거</span>
          </div>
          <div className="flex flex-col gap-2">
            {safePoints.map((pt, i) => <SafePointCard key={i} point={pt} />)}
          </div>
        </div>
      )}

      {/* 위험 요소 (yellow / red) */}
      {!isSafe && result.riskFactors.length > 0 && (
        <div className="p-4 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-black text-white rounded px-1.5 py-[1px]" style={{ background: border }}>!</span>
            <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">위험하다고 판단한 이유 {result.riskFactors.length}가지</span>
          </div>
          <div className="flex flex-col gap-2">
            {result.riskFactors.map(f => <RiskFactorCard key={f.id} factor={f} />)}
          </div>
        </div>
      )}

      {/* 핵심 수치 */}
      {result.status === 'success' && (
        <div className="p-4 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-black text-white rounded px-1.5 py-[1px]" style={{ background: '#555' }}>수치</span>
            <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">분석에 사용된 핵심 수치</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="내 보증금" value={formatWon(result.userDeposit)} />
            <StatBox
              label={result.jeonseCount >= 3 ? `주변 전세 중앙값 (${result.jeonseCount}건)` : `주변 전체 중앙값 (${result.transactionCount}건)`}
              value={formatWon(refMedian ?? 0)}
            />
            {result.depositRatio !== null && (
              <StatBox
                label="주변 시세 대비"
                value={`${result.depositRatio}%`}
                sub={result.depositRatio > 100 ? `시세보다 +${result.depositRatio - 100}% 높음` : '시세 이하 또는 동일'}
                highlight={result.depositRatio >= 130}
              />
            )}
            {result.jeonseRate !== null && (
              <StatBox
                label="전세가율 (보증금 ÷ 집값)"
                value={`${result.jeonseRate}%`}
                sub={result.jeonseRate >= 80 ? '위험 수준' : result.jeonseRate >= 70 ? '주의 수준' : '안전 수준'}
                highlight={result.jeonseRate >= 80}
              />
            )}
          </div>
        </div>
      )}

      {/* 분석 기반 */}
      <div className="p-4 bg-white">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-black rounded px-1.5 py-[1px] text-[#888]" style={{ border: '1px solid #E0E0E0' }}>근거</span>
          <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">이 결과가 나온 근거</span>
        </div>
        <ul className="space-y-1.5 bg-[#FAFAFA] rounded-lg p-3 border border-[#E0E0E0]">
          {result.reasonSummary.map((r, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-[#555] leading-snug">
              <span className="text-[#999] flex-shrink-0">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {result.searchedMonths.length > 0 && (
          <p className="text-[11px] text-[#999] mt-2">
            조회 기간: {result.searchedMonths.map(m => formatYm(m)).join(' / ')} · 거래 {result.transactionCount}건
          </p>
        )}
        {onBackToGuide && (
          <p className="text-[11px] text-[#888] mt-3 leading-relaxed">
            계약 전 추가 확인 목록과 질문·특약 예시는 체크리스트 화면의 <b>부록</b>에서 확인하세요.{' '}
            <button onClick={onBackToGuide} style={{ color: '#009688', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              체크리스트로 →
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
