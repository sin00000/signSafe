'use client';
import React, { useState } from 'react';
import { SignFrame, StatusDot } from './SignFrame';

interface Props {
  id: string;
  title: string;
  summary: string;
  detail: string;
  checked: boolean;
  onToggle: (id: string) => void;
}

// 각 체크 항목의 간단한 픽토그램 SVG
const ITEM_ICONS: Record<string, React.ReactNode> = {
  owner: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="20" y="18" width="60" height="40" rx="4" />
      <circle cx="38" cy="34" r="8" />
      <line x1="50" y1="30" x2="72" y2="30" />
      <line x1="50" y1="42" x2="68" y2="42" />
      <line x1="30" y1="72" x2="38" y2="58" />
      <line x1="70" y1="72" x2="62" y2="58" />
      <line x1="30" y1="72" x2="70" y2="72" />
    </svg>
  ),
  mortgage: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="10,50 50,18 90,50" />
      <rect x="22" y="50" width="56" height="32" rx="2" />
      <line x1="50" y1="82" x2="50" y2="92" />
      <ellipse cx="50" cy="96" rx="18" ry="7" />
      <line x1="32" y1="96" x2="68" y2="96" />
    </svg>
  ),
  register: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="28" cy="28" r="14" />
      <path d="M14,56 C14,40 42,40 42,56" />
      <line x1="52" y1="44" x2="72" y2="44" />
      <polyline points="64,36 72,44 64,52" />
      <polyline points="72,65 90,50 76,30" />
      <polyline points="58,65 76,50 62,30" />
    </svg>
  ),
  fixedDate: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="12" y="18" width="60" height="52" rx="4" />
      <line x1="12" y1="32" x2="72" y2="32" />
      <line x1="28" y1="10" x2="28" y2="26" />
      <line x1="56" y1="10" x2="56" y2="26" />
      <circle cx="80" cy="72" r="18" />
      <line x1="80" y1="62" x2="80" y2="72" />
      <line x1="80" y1="72" x2="90" y2="78" />
    </svg>
  ),
  insurance: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50,8 L88,24 L88,52 C88,72 72,88 50,96 C28,88 12,72 12,52 L12,24 Z" />
      <polyline points="30,50 44,64 70,36" />
    </svg>
  ),
  building: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="15" y="10" width="70" height="80" rx="2" />
      <line x1="15" y1="32" x2="85" y2="32" />
      <rect x="28" y="44" width="14" height="14" />
      <rect x="58" y="44" width="14" height="14" />
      <rect x="28" y="66" width="14" height="14" />
      <rect x="58" y="66" width="14" height="14" />
    </svg>
  ),
  specialTerms: (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15,10 L65,10 L80,25 L80,90 L15,90 Z" />
      <path d="M65,10 L65,25 L80,25" />
      <line x1="28" y1="42" x2="66" y2="42" />
      <line x1="28" y1="55" x2="66" y2="55" />
      <line x1="28" y1="68" x2="50" y2="68" />
    </svg>
  ),
};

export default function CheckItem({ id, title, summary, detail, checked, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const signLevel = checked ? 'green' : 'red';

  return (
    <div
      className="border-2 rounded-lg overflow-hidden transition-all"
      style={{ borderColor: checked ? '#22C55E' : '#E0E0E0', background: checked ? '#F0FDF4' : 'white' }}
    >
      {/* 메인 행 */}
      <div className="flex items-center gap-3 p-3">
        {/* 표지판 픽토그램 */}
        <SignFrame level={signLevel} label={checked ? '완료' : '미확인'} size="sm">
          <div style={{ transform: 'scale(0.9)' }}>
            {ITEM_ICONS[id] ?? (
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="50" cy="50" r="35" />
              </svg>
            )}
          </div>
        </SignFrame>

        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-black leading-tight mb-0.5 ${checked ? 'text-[#166534]' : 'text-[#111]'}`}>{title}</p>
          <p className="text-[11px] text-[#666] leading-snug">{summary}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] font-bold text-[#888] hover:text-[#555] border border-[#E0E0E0] px-2 py-1 rounded"
          >
            {expanded ? '접기' : '펼치기'}
          </button>
          <button
            onClick={() => onToggle(id)}
            className="text-[11px] font-black px-3 py-1.5 rounded-full border-2 transition-all"
            style={checked
              ? { borderColor: '#22C55E', background: '#22C55E', color: 'white' }
              : { borderColor: '#CC1100', color: '#CC1100', background: 'transparent' }
            }
          >
            {checked ? '완료' : '확인'}
          </button>
        </div>
      </div>

      {/* 펼침 상세 */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-[#E0E0E0] bg-[#FAFAFA]">
          <p className="pt-3 text-[12px] text-[#444] leading-relaxed">{detail}</p>
        </div>
      )}
    </div>
  );
}
