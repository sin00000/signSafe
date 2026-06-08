'use client';
import React from 'react';
import CheckItem from './CheckItem';
import BrokerCheckCard, { BROKER_CHECK_ID } from './BrokerCheckCard';

export const CHECK_ITEMS = [
  {
    id: 'owner',
    title: '등기부등본에서 소유자와 계약자가 같은지 확인',
    summary: '계약하는 사람이 실제 집주인인지 먼저 확인해야 합니다.',
    detail:
      '등기부등본 갑구의 소유자 이름과 계약서의 임대인 이름이 다르면 대리권 확인이 필요합니다. 신분증과 등기부등본을 직접 대조하고, 대리인이라면 집주인 인감증명서와 위임장 원본을 반드시 요구하세요. 이름이 다른 경우 계약을 즉시 중단하고 전문가와 상담하세요.',
  },
  {
    id: 'mortgage',
    title: '근저당과 선순위 권리 확인',
    summary: '집에 걸린 빚이 있다면 경매 시 내 보증금보다 은행이 먼저 배당받습니다.',
    detail:
      '등기부등본 을구에서 근저당 채권최고액을 확인하세요. 근저당 금액이 크면 집이 경매에 넘어갔을 때 내 보증금을 돌려받지 못할 수 있습니다. (은행 빚 + 내 보증금)이 집값을 초과하면 특히 위험합니다. 갑구에서 압류·가압류·가처분 표시도 함께 확인하세요.',
  },
  {
    id: 'register',
    title: '전입신고 가능 여부 확인',
    summary: '전입신고를 할 수 없으면 경매 시 보증금을 보호받지 못합니다.',
    detail:
      '전입신고는 이 집에 내가 살고 있다는 것을 법적으로 증명하는 절차입니다. 주거용이 아닌 건물(상가, 고시원 등)이면 전입신고가 안 될 수 있습니다. 전입신고를 할 수 없는 이유를 반드시 파악하고, 이 상태로는 계약을 진행하지 마세요.',
  },
  {
    id: 'fixedDate',
    title: '확정일자 가능 여부 확인',
    summary: '확정일자가 있어야 경매 시 보증금 배당 순위가 생깁니다.',
    detail:
      '확정일자는 내가 언제 이 집에 입주했는지를 법적으로 증명하는 날짜 도장입니다. 전입신고 당일 주민센터에서 무료로 받을 수 있습니다. 확정일자가 없으면 다른 채권자보다 후순위가 되어 보증금을 돌려받기 어렵습니다.',
  },
  {
    id: 'insurance',
    title: '보증보험 가입 가능 여부 확인',
    summary: '보증보험이 없으면 집주인이 보증금을 안 줄 때 소송 외에 방법이 없습니다.',
    detail:
      '전세보증보험은 집주인이 보증금을 돌려주지 않을 때 보증기관이 대신 지급해주는 보험입니다. HUG(1566-9009), HF(한국주택금융공사), SGI서울보증 홈페이지에서 사전 조회하세요. 전세가율이 높거나 근저당이 많으면 가입이 안 될 수 있습니다.',
  },
  {
    id: 'building',
    title: '건축물대장에서 위반건축물 여부 확인',
    summary: '위반건축물은 전세보증보험 가입이 불가하고 법적 보호를 받기 어렵습니다.',
    detail:
      '정부24 또는 세움터에서 건축물대장을 발급받아 위반건축물 여부를 확인하세요. 불법 증축이나 용도변경이 있는 건물은 보증보험 가입이 안 되고, 철거 명령이 내려질 경우 거주 자체가 불가능해질 수 있습니다.',
  },
  {
    id: 'specialTerms',
    title: '계약서 특약 문구 확인',
    summary: '"보증금 반환 면제" 같은 불리한 특약이 있으면 법적 권리를 잃을 수 있습니다.',
    detail:
      '계약서 특약란을 한 줄씩 읽고 이해하세요. "보증금 반환 면제", "전입신고 불가" 같은 조항이 있으면 절대 서명하지 마세요. 이해가 안 되는 조항은 계약 전 법무사나 공인중개사에게 검토를 요청하세요.',
  },
] as const;

interface Props {
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}

export default function CheckProgressList({ checkedIds, onToggle }: Props) {
  const total = CHECK_ITEMS.length + 1; // +1 for broker card
  const done  = CHECK_ITEMS.filter(i => checkedIds.has(i.id)).length
              + (checkedIds.has(BROKER_CHECK_ID) ? 1 : 0);

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-black text-[#111]">계약 전 필수 점검</h3>
          <p className="text-[12px] text-[#888] mt-0.5">항목을 직접 확인했으면 완료 버튼을 누르세요.</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-[#111]">{done}</span>
          <span className="text-sm text-[#888] font-bold">/{total}</span>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-2 bg-[#E0E0E0] rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-[#22C55E] rounded-full transition-all duration-500"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>

      {/* 체크 항목들 */}
      <div className="flex flex-col gap-3">
        {/* 중개사 확인 카드 (최상단 — 계약 전 가장 먼저 확인) */}
        <BrokerCheckCard
          checked={checkedIds.has(BROKER_CHECK_ID)}
          onToggle={onToggle}
        />

        {CHECK_ITEMS.map(item => (
          <CheckItem
            key={item.id}
            {...item}
            checked={checkedIds.has(item.id)}
            onToggle={onToggle}
          />
        ))}
      </div>

      {done === total && (
        <div className="mt-5 bg-[#F0FDF4] border-2 border-[#22C55E] rounded-xl p-4 text-center">
          <p className="text-base font-black text-[#166534]">8개 항목을 모두 확인했습니다.</p>
          <p className="text-[12px] text-[#166534] mt-1">계약 전 기본 점검이 완료되었습니다. 실제 계약 전 전문가 검토도 권장합니다.</p>
        </div>
      )}
    </div>
  );
}
