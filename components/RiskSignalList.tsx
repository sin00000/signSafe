'use client';
import React, { useState } from 'react';
import { RiskSignal, SignalSeverity } from '@/types/rent';

const SEV_CONFIG: Record<SignalSeverity, { dot: string; bg: string; border: string; label: string }> = {
  critical: { dot:'#CC1100', bg:'#FFF5F5', border:'#CC1100', label:'위험' },
  warning:  { dot:'#F5B400', bg:'#FFFBF0', border:'#F5B400', label:'주의' },
  safe:     { dot:'#009688', bg:'#F0FAFA', border:'#009688', label:'안전' },
  unknown:  { dot:'#888',    bg:'#F5F5F5', border:'#E0E0E0', label:'미확인' },
};

function SignalCard({ signal }: { signal: RiskSignal }) {
  const [open, setOpen] = useState(signal.severity === 'critical');
  const cfg = SEV_CONFIG[signal.severity];

  return (
    <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: cfg.border }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: cfg.bg }}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.dot, boxShadow: `0 0 0 3px ${cfg.dot}33` }} />
        <span className="flex-1 text-[13px] font-black text-[#111] leading-snug">{signal.title}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: cfg.dot, color: '#fff' }}>
          {cfg.label}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: `1px solid ${cfg.border}44` }}>
          <div>
            <div className="text-[10px] font-black text-[#888] tracking-widest uppercase mb-1.5">왜 위험한가요?</div>
            <p className="text-[13px] text-[#444] leading-relaxed">{signal.description}</p>
          </div>
          <div>
            <div className="text-[10px] font-black text-[#888] tracking-widest uppercase mb-1.5">근거</div>
            <p className="text-[12px] text-[#666] leading-relaxed bg-[#F5F5F5] px-3 py-2 rounded">{signal.evidence}</p>
          </div>
          <div>
            <div className="text-[10px] font-black text-[#111] tracking-widest uppercase mb-1.5">지금 해야 할 행동</div>
            <p className="text-[13px] font-bold text-[#111] leading-relaxed">{signal.action}</p>
          </div>
          <div className="text-[10px] text-[#888]">출처: {signal.source}</div>
        </div>
      )}
    </div>
  );
}

interface Props {
  criticalSignals: RiskSignal[];
  warningSignals:  RiskSignal[];
  safeSignals:     RiskSignal[];
  unknownSignals?: RiskSignal[];
}

export default function RiskSignalList({ criticalSignals, warningSignals, safeSignals, unknownSignals = [] }: Props) {
  const [showSafe, setShowSafe]    = useState(false);
  const [showUnknown, setShowUnknown] = useState(false);

  return (
    <div className="space-y-6">
      {/* 위험 신호 */}
      {criticalSignals.length > 0 && (
        <Section title={`위험 신호 (${criticalSignals.length}개)`} accent="#CC1100">
          {criticalSignals.map(s => <SignalCard key={s.id} signal={s} />)}
        </Section>
      )}

      {/* 주의 신호 */}
      {warningSignals.length > 0 && (
        <Section title={`주의 신호 (${warningSignals.length}개)`} accent="#F5B400">
          {warningSignals.map(s => <SignalCard key={s.id} signal={s} />)}
        </Section>
      )}

      {/* 안전 신호 — 접기/펼치기 */}
      {safeSignals.length > 0 && (
        <div>
          <button onClick={() => setShowSafe(v => !v)}
            className="flex items-center gap-2 mb-3 text-[#009688] text-sm font-bold hover:opacity-80 transition-opacity">
            <div className="w-2.5 h-2.5 rounded-full bg-[#009688]" />
            확인된 안전 신호 ({safeSignals.length}개)
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {showSafe ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
            </svg>
          </button>
          {showSafe && (
            <div className="space-y-2">
              {safeSignals.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
        </div>
      )}

      {/* 미확인 */}
      {unknownSignals.length > 0 && (
        <div>
          <button onClick={() => setShowUnknown(v => !v)}
            className="flex items-center gap-2 mb-3 text-[#888] text-sm font-bold hover:opacity-80 transition-opacity">
            <div className="w-2.5 h-2.5 rounded-full bg-[#888]" />
            확인 불가 항목 ({unknownSignals.length}개)
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {showUnknown ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
            </svg>
          </button>
          {showUnknown && (
            <div className="space-y-2">
              {unknownSignals.map(s => <SignalCard key={s.id} signal={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />
        <h3 className="text-sm font-black" style={{ color: accent }}>{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
