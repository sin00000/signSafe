'use client';
import React from 'react';

type SignLevel = 'red' | 'yellow' | 'blue' | 'green' | 'gray' | 'black';

interface SignFrameProps {
  level?: SignLevel;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

const LEVEL_STYLES: Record<SignLevel, { bg: string; fg: string; inset: string }> = {
  red:    { bg: '#CC1100', fg: '#ffffff', inset: 'rgba(255,255,255,0.25)' },
  yellow: { bg: '#F5B400', fg: '#111111', inset: 'rgba(0,0,0,0.15)' },
  blue:   { bg: '#009688', fg: '#ffffff', inset: 'rgba(255,255,255,0.25)' },
  green:  { bg: '#22C55E', fg: '#ffffff', inset: 'rgba(255,255,255,0.25)' },
  gray:   { bg: '#888888', fg: '#ffffff', inset: 'rgba(255,255,255,0.20)' },
  black:  { bg: '#111111', fg: '#ffffff', inset: 'rgba(255,255,255,0.20)' },
};

const SIZES = {
  sm: { frame: 'w-[72px]', label: 'text-[8px] py-[2px] px-[4px]', picto: 'p-[6px]' },
  md: { frame: 'w-[96px]', label: 'text-[9px] py-[3px] px-[5px]', picto: 'p-[8px]' },
  lg: { frame: 'w-[128px]', label: 'text-[10px] py-[4px] px-[6px]', picto: 'p-[10px]' },
};

/** 주차 안내판 스타일 사각형 표지판 프레임 */
export function SignFrame({ level = 'gray', label, size = 'md', children }: SignFrameProps) {
  const { bg, fg, inset } = LEVEL_STYLES[level];
  const sz = SIZES[size];
  return (
    <div
      className={`${sz.frame} flex-shrink-0 flex flex-col overflow-hidden`}
      style={{ border: '3.5px solid #111111', borderRadius: 4, boxShadow: '2px 2px 0 rgba(0,0,0,0.2)', background: bg }}
    >
      {label && (
        <div
          className={`${sz.label} font-black text-center tracking-widest uppercase flex-shrink-0`}
          style={{ background: '#111111', color: '#ffffff', letterSpacing: '0.14em' }}
        >
          {label}
        </div>
      )}
      {/* 이중 테두리 인셋 */}
      <div
        className={`flex-1 ${sz.picto} flex items-center justify-center`}
        style={{ color: fg }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ border: `1.5px solid ${inset}`, borderRadius: 2 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── 위험도별 대형 표지판 ────────────────── */
interface RiskSignProps { level: 'red' | 'yellow' | 'blue' | 'gray'; label: string; }

const RISK_LEVEL_SIGN: Record<string, { level: SignLevel; icon: React.ReactNode }> = {
  red:    { level: 'red',   icon: <WarnIcon /> },
  yellow: { level: 'yellow', icon: <CautionIcon /> },
  blue:   { level: 'blue',   icon: <CheckIcon /> },
  gray:   { level: 'gray',   icon: <QuestionIcon /> },
};

export function RiskSign({ level, label }: RiskSignProps) {
  const cfg = RISK_LEVEL_SIGN[level] ?? RISK_LEVEL_SIGN.gray;
  return (
    <div
      className="flex flex-col overflow-hidden flex-shrink-0"
      style={{ width: 140, border: '4px solid #111111', borderRadius: 5, boxShadow: '4px 4px 0 rgba(0,0,0,0.18)', background: LEVEL_STYLES[cfg.level].bg }}
    >
      <div className="py-1.5 text-center font-black text-[10px] tracking-widest text-white" style={{ background: '#111111', letterSpacing: '0.18em' }}>
        분석 결과
      </div>
      <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2" style={{ color: LEVEL_STYLES[cfg.level].fg }}>
        {cfg.icon}
        <span className="text-lg font-black tracking-tight">{label}</span>
      </div>
    </div>
  );
}

/* ── 체크항목용 소형 신호등 표지 ────────── */
interface StatusDotProps { checked: boolean; size?: number; }
export function StatusDot({ checked, size = 14 }: StatusDotProps) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center transition-colors"
      style={{ width: size, height: size, borderRadius: '50%', background: checked ? '#22C55E' : '#CC1100' }}
    >
      {checked && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}

/* ── SVG 아이콘들 ────────────────────────── */
function CheckIcon() {
  return (
    <svg width="52" height="44" viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10,40 L36,66 L90,14" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50,20 L50,58" />
      <circle cx="50" cy="76" r="7" fill="currentColor" stroke="none" />
    </svg>
  );
}
function CautionIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50,15 L88,80 H12 Z" />
      <path d="M50,38 L50,58" />
      <circle cx="50" cy="68" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function QuestionIcon() {
  return (
    <svg width="40" height="44" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M35,30 C35,18 65,18 65,36 C65,50 50,50 50,64" />
      <circle cx="50" cy="76" r="5" fill="currentColor" stroke="none" />
    </svg>
  );
}
