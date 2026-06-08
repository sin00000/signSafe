'use client';
import React, { useState } from 'react';
import { RentAnalysisResult } from '@/types/rent';
import { GLOSSARY_TERMS } from '@/lib/glossary';

const DEFAULT_QUESTIONS = [
  '이 집 등기부등본은 오늘 날짜 기준으로 확인할 수 있나요?',
  '등기부등본상 소유자와 계약 상대방이 같은 사람인가요?',
  '근저당이나 선순위 권리(압류, 가처분 등)가 있나요?',
  '전입신고와 확정일자를 바로 받을 수 있나요?',
  '보증보험(HUG·HF·SGI) 가입이 가능한 집인가요?',
  '건축물대장상 위반건축물 여부를 확인했나요?',
  '계약서 특약에 보증금 보호 관련 문구를 넣을 수 있나요?',
];

const DEFAULT_TERMS = [
  '임대인은 잔금일 이후 추가 근저당권 등 제한물권을 설정하지 않는다.',
  '임대인은 임차인의 전입신고 및 확정일자 취득에 협조한다.',
  '임대인의 귀책으로 전세보증보험 가입이 불가한 경우 임차인은 계약 해제를 요구할 수 있다.',
  '계약 체결 후 등기부등본상 중대한 권리 변동 시 임차인은 계약 해제 및 보증금 전액 반환을 요구할 수 있다.',
  '임대차 기간 중 임대인이 위 주택을 제3자에게 매도하는 경우 임차인의 대항력은 그대로 유지된다.',
];

const formatTerm = (t: typeof GLOSSARY_TERMS[number]) => `${t.term}(${t.plain}) — ${t.definition}`;

type TabId = 'questions' | 'terms' | 'glossary';

const TABS: { id: TabId; label: string; color: string; bg: string; dim: string }[] = [
  { id: 'questions', label: '질문',    color: '#009688', bg: '#F0FAFA', dim: '#00695C' },
  { id: 'terms',     label: '특약 예시', color: '#F5B400', bg: '#FFFBF0', dim: '#7A5900' },
  { id: 'glossary',  label: '용어 정리', color: '#6B5BD6', bg: '#F2F0FF', dim: '#4B3FA0' },
];

interface Props {
  result: RentAnalysisResult | null;
}

function CopyRow({ idx, text, copiedIdx, onCopy, accentColor, badge }: {
  idx: number; text: string; copiedIdx: number | null;
  onCopy: (idx: number, text: string) => void; accentColor: string; badge: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-lg px-4 py-3 border border-[#E0E0E0]">
      <span className="text-[11px] font-black flex-shrink-0 mt-0.5" style={{ color: accentColor }}>{badge}</span>
      <p className="text-[13px] text-[#333] font-bold leading-snug flex-1" style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}>{text}</p>
      <button onClick={() => onCopy(idx, text)} className="text-[10px] text-[#888] flex-shrink-0 mt-0.5 transition-colors hover:opacity-70" style={{ color: copiedIdx === idx ? accentColor : '#888' }}>
        {copiedIdx === idx ? '✓ 복사됨' : '복사'}
      </button>
    </div>
  );
}

export default function GuideToolsBar({ result }: Props) {
  const [tab, setTab] = useState<TabId | null>(null);
  const [copied, setCopied] = useState<{ tab: TabId; idx: number } | null>(null);

  const questions = result?.questionsToAsk ?? DEFAULT_QUESTIONS;
  const terms = result?.contractSpecialTerms ?? DEFAULT_TERMS;

  const copyOne = (which: TabId, idx: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied({ tab: which, idx });
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const copyAll = (which: TabId, joined: string) => {
    navigator.clipboard.writeText(joined).then(() => {
      setCopied({ tab: which, idx: -1 });
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const active = TABS.find(t => t.id === tab) ?? null;

  return (
    <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: active ? active.color : '#E0E0E0', flexShrink: 0 }}>
      {/* 삼분할 탭 — 클릭하면 해당 영역이 펼쳐짐 */}
      <div className="grid grid-cols-3">
        {TABS.map((t, i) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(v => v === t.id ? null : t.id)}
              className="px-2 py-3 text-center text-[13px] font-black transition-colors"
              style={{
                background: isActive ? t.color : '#FAFAFA',
                color: isActive ? '#fff' : '#999',
                borderRight: i < 2 ? '1px solid #E0E0E0' : undefined,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active && (
        <div style={{ background: active.bg, maxHeight: '46vh', overflowY: 'auto' }}>
          {active.id === 'questions' && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold" style={{ color: active.dim }}>중개사·집주인에게 이 질문들을 그대로 던져 보세요.</p>
                <span
                  role="button"
                  onClick={() => copyAll('questions', questions.map((q, i) => `Q${i + 1}. ${q}`).join('\n'))}
                  className="text-[11px] font-bold border px-2.5 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                  style={{ color: active.dim, borderColor: active.dim + '55' }}
                >
                  {copied?.tab === 'questions' && copied.idx === -1 ? '복사됨 ✓' : '전체 복사'}
                </span>
              </div>
              {questions.map((q, i) => (
                <CopyRow key={i} idx={i} text={q} copiedIdx={copied?.tab === 'questions' ? copied.idx : null}
                  onCopy={(idx, text) => copyOne('questions', idx, text)} accentColor={active.color} badge={`Q${i + 1}`} />
              ))}
            </div>
          )}

          {active.id === 'terms' && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold" style={{ color: active.dim }}>상황에 맞게 수정해 계약서 특약란에 추가하세요.</p>
                <span
                  role="button"
                  onClick={() => copyAll('terms', terms.join('\n'))}
                  className="text-[11px] font-bold border px-2.5 py-1 rounded transition-colors flex-shrink-0 cursor-pointer"
                  style={{ color: active.dim, borderColor: active.dim + '55' }}
                >
                  {copied?.tab === 'terms' && copied.idx === -1 ? '복사됨 ✓' : '전체 복사'}
                </span>
              </div>
              {terms.map((term, i) => (
                <CopyRow key={i} idx={i} text={`"${term}"`} copiedIdx={copied?.tab === 'terms' ? copied.idx : null}
                  onCopy={(idx, text) => copyOne('terms', idx, text)} accentColor={active.color} badge={`특약 ${i + 1}`} />
              ))}
              <p className="text-[11px] text-[#888] bg-white rounded p-3 border border-[#E0E0E0] mt-1">
                ⚠ 특약 문구는 상황에 따라 달라질 수 있습니다. 실제 계약 전 공인중개사 또는 법무사와 확인하세요.
              </p>
            </div>
          )}

          {active.id === 'glossary' && (
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-bold mb-1" style={{ color: active.dim }}>계약서·등기부등본에서 만날 단어들을 미리 정리했어요.</p>
              {GLOSSARY_TERMS.map((t, i) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-lg px-4 py-3 border border-[#E0E0E0]">
                  <div className="flex-1">
                    <p className="text-[13px] text-[#333] leading-snug" style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}>
                      <span className="font-black" style={{ color: active.color }}>{t.term}</span>
                      <span className="text-[#888]">({t.plain})</span>
                      <span className="font-bold"> — {t.definition}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => copyOne('glossary', i, formatTerm(t))}
                    className="text-[10px] flex-shrink-0 mt-0.5 transition-colors hover:opacity-70"
                    style={{ color: copied?.tab === 'glossary' && copied.idx === i ? active.color : '#888' }}
                  >
                    {copied?.tab === 'glossary' && copied.idx === i ? '✓ 복사됨' : '복사'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
