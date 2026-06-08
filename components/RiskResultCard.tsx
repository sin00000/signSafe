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

/* 신호등 색 이름 대신 의미를 그대로 드러내는 4단계 분류로 표시: 위험/주의/안전/자료 부족 */
const RISK_SIGN_LABELS: Record<string, string> = {
  red: '위험', yellow: '주의', blue: '안전', gray: '자료 부족',
};

/* 분석할 수치(주소·보증금·집값)가 없을 때 — 체크리스트를 얼마나 확인했는지를 기준으로
   대신 보여줄 신호. 빨강(거의 안 함) → 노랑(절반 정도) → 파랑(대부분 확인) → 회색(아직 0개) */
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
      message: `전체 ${totalChecks}개 중 ${checkedCount}개를 확인했습니다. 남은 항목, 특히 자동 계산이 필요한 항목을 마저 확인하면 더 정확한 분석을 받을 수 있어요.` };
  }
  return { level: 'blue', pct, title: '체크리스트를 거의 다 확인했어요',
    message: `전체 ${totalChecks}개 중 ${checkedCount}개(${pct}%)를 확인했습니다. 주소·보증금·집값을 입력하면 수치 기반의 정밀 분석도 함께 받을 수 있어요.` };
}

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded p-3 border ${highlight ? 'border-[#CC1100] bg-[#FFF5F5]' : 'border-[#E0E0E0] bg-white'}`}>
      <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-lg font-black leading-tight ${highlight ? 'text-[#CC1100]' : 'text-[#111]'}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#888] mt-0.5">{sub}</div>}
    </div>
  );
}

function RiskFactorCard({ factor }: { factor: { level: string; title: string; description: string; action: string } }) {
  const [open, setOpen] = useState(false);
  const color = factor.level === 'red' ? '#CC1100' : factor.level === 'yellow' ? '#F5B400' : '#009688';
  const bg    = factor.level === 'red' ? '#FFF5F5' : factor.level === 'yellow' ? '#FFFBF0' : '#F0FAFA';

  return (
    <div className="border-2 rounded-lg overflow-hidden" style={{ borderColor: color }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: bg }}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 0 3px ${color}33` }} />
        <span className="flex-1 text-[13px] font-black text-[#111] leading-tight">{factor.title}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t" style={{ borderColor: color + '44' }}>
          <p className="text-[13px] text-[#444] leading-relaxed mb-3">{factor.description}</p>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color }}>지금 할 일</div>
            <p className="text-[12px] font-bold text-[#111] leading-relaxed">{factor.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

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
    /* 수치 분석에 필요한 정보(주소·보증금·집값)가 없을 때 — 체크리스트를 얼마나 확인했는지를
       대신 기준 삼아 빨강/노랑/파랑/회색 신호를 보여줍니다. */
    const fb = fallbackSignalFromChecks(checkedCount, totalChecks);
    const fbColors = {
      red:    { border: '#CC1100', bg: '#FFF5F5' },
      yellow: { border: '#F5B400', bg: '#FFFBF0' },
      blue:   { border: '#009688', bg: '#F0FAFA' },
      gray:   { border: '#888',    bg: '#F5F5F5' },
    }[fb.level];

    return (
      <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: fbColors.border }}>
        <div className="p-5 flex gap-5 items-start" style={{ background: fbColors.bg, borderBottom: `2px solid ${fbColors.border}` }}>
          <RiskSign level={fb.level} label={RISK_SIGN_LABELS[fb.level]} />
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#888] mb-1.5" style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}>체크리스트 기준 임시 신호 · 수치 입력 전</div>
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
    blue:   { border: '#009688', bg: '#F0FAFA' },
    yellow: { border: '#F5B400', bg: '#FFFBF0' },
    red:    { border: '#CC1100', bg: '#FFF5F5' },
    gray:   { border: '#888',    bg: '#F5F5F5' },
  };
  const { border, bg } = riskColors[result.riskLevel] ?? riskColors.gray;

  return (
    <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: border }}>
      {/* 표지판 + 메시지 헤더 */}
      <div className="p-5 flex gap-5 items-start" style={{ background: bg, borderBottom: `2px solid ${border}` }}>
        <RiskSign level={result.riskLevel as 'blue' | 'yellow' | 'red' | 'gray'} label={RISK_SIGN_LABELS[result.riskLevel]} />
        <div className="flex-1">
          <h2 className="text-[15px] font-black text-[#111] leading-tight mb-2">{result.riskTitle}</h2>
          <p className="text-[12px] text-[#555] leading-relaxed">{result.riskMessage}</p>
        </div>
      </div>

      {/* 수치 — 위계 1: 핵심 숫자 */}
      {result.status === 'success' && (
        <div className="p-4 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-black text-white rounded px-1.5 py-[1px]" style={{ background: border }}>1</span>
            <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">핵심 수치 — 내 보증금과 시세 비교</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
          <StatBox label="내 보증금" value={formatWon(result.userDeposit)} />
          <StatBox
            label={`주변 전세 중앙값`}
            value={formatWon(result.medianJeonseDeposit ?? result.medianAllDeposit ?? 0)}
            sub={`${result.jeonseCount >= 3 ? `전세 ${result.jeonseCount}건` : `전체 ${result.transactionCount}건`} 기준`}
          />
          {result.depositRatio !== null && (
            <StatBox
              label="주변 시세 대비"
              value={`${result.depositRatio}%`}
              sub={result.depositRatio > 100 ? `+${result.depositRatio - 100}% 높음` : '시세 수준'}
              highlight={result.depositRatio >= 130}
            />
          )}
          {result.jeonseRate !== null && (
            <StatBox
              label="전세가율"
              value={`${result.jeonseRate}%`}
              sub={result.jeonseRate >= 80 ? '위험 수준' : result.jeonseRate >= 70 ? '주의 수준' : '안전 수준'}
              highlight={result.jeonseRate >= 80}
            />
          )}
          </div>
        </div>
      )}

      {/* 개별 위험 요소 — 위계 2: 무엇이 문제인가 */}
      {result.riskFactors.length > 0 && (
        <div className="p-4 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-black text-white rounded px-1.5 py-[1px]" style={{ background: border }}>2</span>
            <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">발견된 위험 요소 {result.riskFactors.length}개 — 눌러서 자세히, 할 일 확인</span>
          </div>
          <div className="flex flex-col gap-2">
            {result.riskFactors.map(f => <RiskFactorCard key={f.id} factor={f} />)}
          </div>
        </div>
      )}

      {/* 분석 근거 — 위계 3: 왜 이런 결과가 나왔나 */}
      <div className="p-4 bg-white">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-[10px] font-black text-white rounded px-1.5 py-[1px]" style={{ background: border }}>3</span>
          <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">이런 결과가 나온 이유</span>
        </div>
        <ul className="space-y-1.5 bg-[#FAFAFA] rounded-lg p-3 border border-[#E0E0E0]">
          {result.reasonSummary.map((r, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-[#555] leading-snug">
              <span className="text-[#888] flex-shrink-0 font-black">{i + 1}.</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {result.searchedMonths.length > 0 && (
          <p className="text-[11px] text-[#888] mt-2.5">
            📅 조회 기간: {result.searchedMonths.map(m => formatYm(m)).join(' / ')}
          </p>
        )}
      </div>
    </div>
  );
}
