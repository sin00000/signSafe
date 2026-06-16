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
          <div className="text-xs font-bold text-[#009688] tracking-widest uppercase mb-4">전세 계약 위험 점검 서비스</div>
          <h1 className="text-4xl md:text-5xl font-black text-[#111] leading-tight tracking-tight mb-3">
            처음으로 집 알아보는 게 어려워!
          </h1>
          <p className="text-[15px] text-[#555] leading-relaxed mb-6">
            계약서 서명 전 확인해야 할 항목을<br />단계별로 안내합니다.
          </p>

          {/* 색상 범례 */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex items-center gap-2">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#FFF0EE', border: '1.5px solid #F5C5BF', flexShrink: 0 }} />
              <span className="text-[12px] font-bold text-[#CC1100]">위험</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#FFF8E2', border: '1.5px solid #E8D070', flexShrink: 0 }} />
              <span className="text-[12px] font-bold text-[#B07B00]">주의</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#EDFAF7', border: '1.5px solid #A8E6DF', flexShrink: 0 }} />
              <span className="text-[12px] font-bold text-[#007A6E]">완료</span>
            </div>
          </div>

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
