'use client';
import React, { useState } from 'react';

interface Props {
  checked: boolean;
  onToggle: (id: string) => void;
}

export const BROKER_CHECK_ID = 'broker';

export default function BrokerCheckCard({ checked, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-2 rounded-lg overflow-hidden transition-all"
      style={{
        borderColor: checked ? '#22C55E' : '#F5B400',
        background: checked ? '#F0FDF4' : '#FFFBF0',
      }}
    >
      {/* 상단 상태 배지 */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{ background: checked ? '#22C55E' : '#F5B400' }}
      >
        <div className="w-2 h-2 rounded-full bg-white" />
        <span className="text-[11px] font-black text-white tracking-wide">
          {checked ? '중개사 확인 완료' : '중개사 등록 여부 미확인'}
        </span>
      </div>

      {/* 메인 행 */}
      <div className="flex items-start gap-3 p-3">
        {/* 픽토그램 */}
        <div
          className="flex-shrink-0 rounded border-2 flex items-center justify-center"
          style={{
            width: 52, height: 52,
            borderColor: checked ? '#22C55E' : '#F5B400',
            background: checked ? '#D1FAE5' : '#FEF3C7',
            color: checked ? '#166534' : '#7A5900',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="22" width="76" height="56" rx="5" />
            <line x1="12" y1="40" x2="88" y2="40" />
            <circle cx="34" cy="31" r="5" />
            <circle cx="50" cy="31" r="5" />
            <line x1="28" y1="55" x2="72" y2="55" />
            <line x1="28" y1="67" x2="55" y2="67" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-black leading-tight mb-1 ${checked ? 'text-[#166534]' : 'text-[#111]'}`}>
            중개사 확인
          </p>
          <p className="text-[11px] text-[#666] leading-snug">
            계약서에 기재된 중개사무소 정보를 공식 조회 시스템에서 확인하세요.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] font-bold text-[#888] hover:text-[#555] border border-[#E0E0E0] px-2 py-1 rounded bg-white"
          >
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>

      {/* 펼침 상세 */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: checked ? '#86EFAC' : '#FDE68A' }}>
          <div className="pt-3 space-y-4">

            {/* 확인할 정보 */}
            <div>
              <p className="text-[12px] text-[#555] leading-relaxed mb-3">
                공식 조회 사이트에서 아래 정보가 <strong>계약서와 일치하는지</strong> 확인하세요.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['중개사무소명', '대표자명', '등록번호', '영업상태', '주소'].map(item => (
                  <span
                    key={item}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: '#F5F5F5', border: '1.5px solid #E0E0E0', color: '#333' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* 조회 박스 */}
            <a
              href="https://www.vworld.kr/dtld/broker/dtld_list_s001.do"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                border: '2.5px solid #111',
                borderRadius: 6,
                padding: '14px 16px',
                background: '#fff',
                textDecoration: 'none',
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#111', marginBottom: 3 }}>
                    국토부 중개사무소 공식 조회
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    www.vworld.kr · 중개사무소 등록현황 조회 시스템
                  </div>
                </div>
                <div style={{
                  flexShrink: 0, marginLeft: 12,
                  width: 36, height: 36,
                  background: '#111', borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
              </div>
            </a>

            {/* 확인 체크박스 */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <button
                onClick={() => onToggle(BROKER_CHECK_ID)}
                className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-0.5"
                style={{
                  borderColor: checked ? '#22C55E' : '#E0E0E0',
                  background: checked ? '#22C55E' : '#fff',
                }}
              >
                {checked && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
              <span
                className="text-[13px] font-bold leading-snug"
                style={{ color: checked ? '#166534' : '#333' }}
                onClick={() => onToggle(BROKER_CHECK_ID)}
              >
                조회 결과가 계약서 정보와 일치합니다
              </span>
            </label>

          </div>
        </div>
      )}

      {/* 미확인 상태 안내 (접힌 상태) */}
      {!expanded && !checked && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setExpanded(true)}
            className="text-[11px] font-bold text-[#7A5900] underline"
          >
            공식 조회 방법 보기 →
          </button>
        </div>
      )}
    </div>
  );
}
