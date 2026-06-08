'use client';
import React from 'react';

interface Props {
  onStart: () => void;
}

export default function StartScreen({ onStart }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <header className="bg-[#111] text-white px-6 py-3 flex items-center gap-3">
        <span className="text-sm font-black tracking-tight">계약전야</span>
        <span className="text-xs text-white/40 ml-1">전세 계약 내비게이션</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {/* 메인 타이틀 */}
          <div className="text-sm font-bold text-[#009688] tracking-widest uppercase mb-4">초보자를 위한 전세사기 퇴치맵</div>
          <h1 className="text-4xl md:text-5xl font-black text-[#111] leading-tight tracking-tight mb-10">
            전세사기는<br />
            <span className="text-[#CC1100]">어디에나 있다!</span>
          </h1>

          <button
            onClick={onStart}
            className="w-full bg-[#111] text-white py-4 rounded font-black text-lg tracking-tight hover:bg-[#333] transition-colors flex items-center justify-center gap-3 mt-10"
          >
            내 집이 전세사기인지 알아보기
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <p className="text-[11px] text-[#888] text-center mt-4 leading-relaxed">
            참고용 진단 서비스 — 전세사기 여부를 확정하지 않습니다.<br />
            실제 계약 전 반드시 전문가 검토를 권장합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
