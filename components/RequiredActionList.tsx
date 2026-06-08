'use client';
import React, { useState } from 'react';

const DEFAULT_ACTIONS = [
  { title: '등기부등본 갑구 확인', detail: '소유자 이름과 계약자 신분증 이름을 직접 대조하세요. 계약 당일 오전에 다시 발급받으세요 (대법원 인터넷등기소, 700원).' },
  { title: '등기부등본 을구 확인', detail: '근저당 채권최고액을 확인하세요. (근저당 + 보증금)이 매매가보다 낮은지 계산하세요.' },
  { title: '압류·가처분 여부 확인', detail: '등기부등본 갑구에서 "압류", "가압류", "가처분" 단어가 있는지 확인하세요.' },
  { title: '전세보증보험 사전 조회', detail: 'HUG(1566-9009), HF(1800-2500), SGI서울보증 중 한 곳에서 가입 가능 여부를 사전 조회하세요.' },
  { title: '건축물대장 발급', detail: '정부24(www.gov.kr)에서 건축물대장을 발급받아 위반건축물 여부와 건물 용도를 확인하세요.' },
  { title: '전입신고 및 확정일자', detail: '이사 당일 주민센터에서 전입신고와 확정일자를 함께 처리하세요. 무료입니다.' },
];

interface Props {
  questions?: string[];
}

export default function RequiredActionList({ questions }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setChecked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="space-y-6">
      {/* 체크리스트 */}
      <div>
        <h3 className="text-sm font-black text-[#111] uppercase tracking-widest mb-3">계약 전 최종 확인 항목</h3>
        <div className="space-y-2">
          {DEFAULT_ACTIONS.map((a, i) => (
            <ActionItem key={i} idx={i} title={a.title} detail={a.detail}
              checked={checked.has(i)} onToggle={() => toggle(i)} />
          ))}
        </div>
        <div className="mt-3 text-[11px] text-[#888]">
          {checked.size}/{DEFAULT_ACTIONS.length}개 완료
        </div>
      </div>

      {/* 중개사 질문 */}
      {questions && questions.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-[#009688] uppercase tracking-widest mb-3">중개사에게 물어볼 질문</h3>
          <div className="bg-[#F0FAFA] border-2 border-[#009688] rounded-xl p-4 space-y-2.5">
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-[11px] font-black text-[#009688] flex-shrink-0 mt-0.5">Q{i + 1}</span>
                <p className="text-[13px] font-bold text-[#333]">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionItem({ idx, title, detail, checked, onToggle }: {
  idx: number; title: string; detail: string; checked: boolean; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2 rounded-lg overflow-hidden transition-all"
      style={{ borderColor: checked ? '#009688' : '#E0E0E0', background: checked ? '#F0FAFA' : '#fff' }}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button onClick={onToggle}
          className="w-6 h-6 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all"
          style={{ borderColor: checked ? '#009688' : '#E0E0E0', background: checked ? '#009688' : '#fff' }}>
          {checked && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>
        <span className="flex-1 text-[13px] font-bold" style={{ color: checked ? '#005C54' : '#111' }}>{title}</span>
        <button onClick={() => setOpen(v => !v)} className="text-[10px] text-[#888] border border-[#E0E0E0] px-2 py-0.5 rounded">
          {open ? '접기' : '상세'}
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 text-[12px] text-[#555] leading-relaxed" style={{ borderTop: '1px solid #F0F0F0' }}>
          <div className="pt-2">{detail}</div>
        </div>
      )}
    </div>
  );
}
