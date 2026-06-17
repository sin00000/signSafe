'use client';
import React, { useState } from 'react';
import { RentAnalysisResult, AnalysisStatus } from '@/types/rent';
import { formatWon } from '@/lib/formatMoney';
import { formatYm } from '@/lib/dateUtils';
import { CHECK_ITEMS } from '@/lib/checkData';

interface Props {
  result: RentAnalysisResult | null;
  status: AnalysisStatus;
  errorMessage?: string;
  checkedIds?: Set<string>;
  checkedCount?: number;
  totalChecks?: number;
  onBackToGuide?: () => void;
}

/* ── idle 분석용 상수 ────────────────────────── */
const DANGER_ITEMS = CHECK_ITEMS.filter(c => c.risk === 'danger');

const CHECKLIST_LABEL: Record<string, string> = {
  s0i0: '집 직접 방문 확인',
  s0i2: '주거용 건물 여부 확인',
  s1i0: '집주인 신원 대조 확인',
  s2i1: '전세가율 70% 이하 확인',
  s3i0: '계약 당일 등기부등본 재발급 확인',
  s3i1: '근저당(채권최고액) 확인',
  s3i2: '압류·처분금지 없음 확인',
  s4i0: '전세보증보험 가입 가능 여부 확인',
  s5i0: '계약서 불리한 특약 없음 확인',
  s6i0: '이사 당일 전입신고 완료',
  s6i1: '확정일자 취득 완료',
};

const CHECKED_SAFETY_MEANING: Record<string, string> = {
  s0i0: '실제로 존재하는 집을 직접 확인했습니다. 허위 매물에 계약금을 날리는 1차 위험을 차단했습니다.',
  s0i2: '주택임대차보호법 보호 대상인 건물임을 확인했습니다. 전세보증보험 가입이 가능한 조건을 갖췄습니다.',
  s1i0: '등기부등본 소유자와 계약 상대방을 직접 대조했습니다. 가짜 집주인에 의한 무효 계약 위험이 없습니다.',
  s2i1: '집값 대비 보증금 비율(전세가율)을 파악했습니다. 깡통전세 여부를 판단할 핵심 수치를 직접 계산했습니다.',
  s3i0: '계약 당일 등기부등본을 새로 발급해 최종 상태를 확인했습니다. 직전에 생긴 담보 추가나 소유권 변동을 막는 마지막 확인입니다.',
  s3i1: '근저당 채권최고액을 확인했습니다. (근저당+보증금)이 집값 이내인지 직접 계산해 경매 시 회수 가능성을 점검했습니다.',
  s3i2: '압류·처분금지가 없음을 확인했습니다. 집주인이 법적 분쟁 중이지 않아 갑작스러운 경매 위험이 없습니다.',
  s4i0: '전세보증보험 가입 가능 여부를 사전 조회했습니다. 집주인이 보증금을 돌려주지 않을 때를 대비한 최후 안전망 확보 여부를 확인했습니다.',
  s5i0: '계약서 특약을 직접 검토했습니다. 보증금 반환을 어렵게 만드는 독소 조항이 없음을 확인했습니다.',
  s6i0: '이사 당일 전입신고를 마쳐 대항력을 즉시 확보했습니다. 경매가 진행되더라도 보증금 우선 회수 권리를 갖게 됐습니다.',
  s6i1: '확정일자를 취득해 경매 배당 순위를 확보했습니다. 전입신고와 함께 보증금 법적 보호의 두 축을 모두 갖췄습니다.',
};

/* ── 안전 근거 생성 ─────────────────────────── */
interface SafePoint { text: string; detail: string }

function buildSafePoints(r: RentAnalysisResult): SafePoint[] {
  const pts: SafePoint[] = [];
  const refMedian = r.jeonseCount >= 3 ? r.medianJeonseDeposit : r.medianAllDeposit;

  if (r.depositRatio !== null && refMedian !== null) {
    const diff = 100 - r.depositRatio;
    if (diff >= 10) {
      pts.push({
        text: `주변 전세 시세보다 ${diff}% 낮은 보증금`,
        detail: `주변 전세 실거래 중앙값은 ${formatWon(refMedian)}이고, 내 보증금(${formatWon(r.userDeposit)})은 이보다 ${diff}% 낮습니다. 집값이 시세만큼 하락하더라도 보증금 전액을 회수할 여유가 충분합니다.`,
      });
    } else if (r.depositRatio <= 110) {
      pts.push({
        text: `주변 시세와 비슷한 수준 (시세 대비 ${r.depositRatio}%)`,
        detail: `주변 전세 실거래 중앙값(${formatWon(refMedian)}) 대비 ${r.depositRatio}% 수준입니다. 깡통전세 경보선(130%)을 크게 밑돌아 과도하게 높은 계약은 아닙니다.`,
      });
    }
  }

  if (r.jeonseRate !== null) {
    if (r.jeonseRate < 60) {
      pts.push({
        text: `전세가율 ${r.jeonseRate}% — 집값의 절반 수준`,
        detail: `보증금이 집값의 ${r.jeonseRate}%입니다. 경매 낙찰가율(통상 70~80%)을 고려해도 보증금 전액 회수에 충분한 여유가 있습니다. 집값이 ${100 - r.jeonseRate}% 이상 폭락해야 위험해지는 수준입니다.`,
      });
    } else if (r.jeonseRate < 70) {
      pts.push({
        text: `전세가율 ${r.jeonseRate}% — 안전 권고선(70%) 이하`,
        detail: `보증금이 집값의 ${r.jeonseRate}%입니다. 업계에서 안전 기준으로 쓰는 70%를 충족합니다. HUG·HF 전세보증보험 가입 원칙상 가능한 범위이기도 합니다.`,
      });
    } else if (r.jeonseRate < 80) {
      pts.push({
        text: `전세가율 ${r.jeonseRate}% — 위험 경보선(80%) 미만`,
        detail: `보증금이 집값의 ${r.jeonseRate}%입니다. 권고 기준(70%)은 넘었지만 위험 경보선(80%)은 아직 밑돌고 있습니다. 보증보험 가입 가능 여부를 직접 조회하면 추가 안전장치를 확인할 수 있습니다.`,
      });
    }
  }

  if (r.riskFactors.length === 0) {
    pts.push({
      text: '입력된 정보 기준 추가 위험 요소 없음',
      detail: '집값·근저당·소유자 일치 여부·보증보험 가능 여부 등 입력된 모든 항목에서 위험 신호가 발견되지 않았습니다. 단, 입력하지 않은 항목은 분석에 반영되지 않았습니다.',
    });
  }

  if (r.jeonseCount >= 5) {
    pts.push({
      text: `비교 데이터 ${r.jeonseCount}건 — 통계적으로 신뢰 가능한 시세`,
      detail: `이 분석에 사용된 전세 실거래 건수가 ${r.jeonseCount}건입니다. 표본이 충분해 중앙값 시세의 신뢰도가 높습니다. 1~2건짜리 분석보다 훨씬 안정적인 시세 비교입니다.`,
    });
  } else if (r.jeonseCount >= 1) {
    pts.push({
      text: `전세 실거래 ${r.jeonseCount}건 — 주변 전체 시세도 함께 참고`,
      detail: `전세 거래 건수(${r.jeonseCount}건)가 적어 같은 동네 전체 임대차 거래 중앙값도 함께 반영했습니다. 호갱노노 등에서 단지별 시세를 추가로 확인하는 것을 권장합니다.`,
    });
  }

  return pts;
}

/* ── 서브 컴포넌트들 ────────────────────────── */
function SectionLabel({ marker, color, label }: { marker: string; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: color, borderRadius: 3, padding: '1px 5px' }}>{marker}</span>
      <span style={{ fontSize: 10, fontWeight: 900, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
    </div>
  );
}

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ borderRadius: 6, padding: '10px 12px', border: `1.5px solid ${highlight ? '#CC1100' : '#E0E0E0'}`, background: highlight ? '#FFF5F5' : '#fff' }}>
      <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: highlight ? '#CC1100' : '#111', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: highlight ? '#CC1100' : '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SafePointCard({ point }: { point: SafePoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#F0FAF8', border: '1.5px solid #B2DFDB', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 11, fontWeight: 900, color: '#009688', flexShrink: 0, marginTop: 1 }}>✓</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#0D3D35', lineHeight: '20pt' }}>{point.text}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#009688" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}>
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && (
        <p style={{ fontSize: 12, color: '#334', lineHeight: '20pt', padding: '0 14px 12px 33px', margin: 0 }}>{point.detail}</p>
      )}
    </div>
  );
}

function RiskFactorCard({ factor }: { factor: { level: string; title: string; description: string; action: string } }) {
  const [open, setOpen] = useState(false);
  const color = factor.level === 'red' ? '#CC1100' : factor.level === 'yellow' ? '#E6A000' : '#009688';
  const bg    = factor.level === 'red' ? '#FFF5F5' : factor.level === 'yellow' ? '#FFFBF0' : '#F0FAFA';

  return (
    <div style={{ border: `1.5px solid ${color}`, borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', background: bg, border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 11, fontWeight: 900, color, flexShrink: 0, marginTop: 1 }}>
          {factor.level === 'red' ? '!' : '⚠'}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#111', lineHeight: '20pt' }}>{factor.title}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}>
          {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      </button>
      {open && (
        <div style={{ padding: '12px 14px 14px', background: '#fff', borderTop: `1px solid ${color}33` }}>
          <p style={{ fontSize: 13, color: '#333', lineHeight: '22pt', margin: '0 0 12px' }}>{factor.description}</p>
          <div style={{ background: `${color}11`, borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color, marginBottom: 4 }}>지금 해야 할 일</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: '22pt', margin: 0 }}>{factor.action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── idle 상태: 체크리스트 기반 분석 ─────── */
function ChecklistAnalysis({ checkedIds, totalChecks, onBackToGuide }: { checkedIds: Set<string>; totalChecks: number; onBackToGuide?: () => void }) {
  const confirmed = DANGER_ITEMS.filter(item => checkedIds.has(item.id));
  const pending   = DANGER_ITEMS.filter(item => !checkedIds.has(item.id));
  const checkedCount = checkedIds.size;
  const pct = totalChecks > 0 ? Math.round((checkedCount / totalChecks) * 100) : 0;
  const barColor = pct >= 80 ? '#009688' : pct >= 40 ? '#E6A000' : checkedCount === 0 ? '#999' : '#CC1100';

  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 진행 요약 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>체크리스트 진행</span>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#111' }}>{checkedCount} / {totalChecks}개 · {pct}%</span>
        </div>
        <div style={{ height: 4, background: '#EBEBEB', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: barColor, width: `${pct}%`, transition: 'width 0.45s ease' }} />
        </div>
      </div>

      {/* 확인 완료 */}
      {confirmed.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#009688', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            확인 완료 — 안전 확보 {confirmed.length}가지
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {confirmed.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, color: '#009688', fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111', lineHeight: '20pt' }}>
                    {CHECKLIST_LABEL[item.id] ?? item.q}
                  </div>
                  <p style={{ fontSize: 11, color: '#666', lineHeight: '18pt', margin: '2px 0 0' }}>
                    {CHECKED_SAFETY_MEANING[item.id] ?? item.whyItMatters}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미확인 항목 */}
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#CC1100', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            미확인 — 핵심 항목 {pending.length}가지
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, color: '#CC1100', fontWeight: 900, flexShrink: 0, marginTop: 1 }}>·</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#333', lineHeight: '20pt' }}>
                    {CHECKLIST_LABEL[item.id] ?? item.q}
                  </div>
                  <p style={{ fontSize: 11, color: '#888', lineHeight: '18pt', margin: '2px 0 0' }}>{item.consequence}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 수치 분석 안내 */}
      <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 16 }}>
        <p style={{ fontSize: 12, color: '#888', lineHeight: '20pt', margin: '0 0 10px' }}>
          체크리스트 2단계에서 <b style={{ color: '#333' }}>주소 · 보증금 · 계약월</b>을 입력하면
          주변 실거래가 기반 시세 비교와 전세가율 분석이 추가됩니다.
        </p>
        {onBackToGuide && (
          <button
            onClick={onBackToGuide}
            style={{ fontSize: 12, fontWeight: 800, color: '#009688', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            체크리스트로 가서 입력하기 →
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ──────────────────────────── */
export default function RiskResultCard({
  result, status, errorMessage,
  checkedIds, checkedCount: checkedCountProp = 0, totalChecks = 0,
  onBackToGuide,
}: Props) {
  const effectiveCheckedIds = checkedIds ?? new Set<string>();
  const checkedCount = checkedIds ? checkedIds.size : checkedCountProp;

  if (status === 'loading') {
    return (
      <div style={{ background: '#fff', border: '2px solid #E0E0E0', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #009688', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 4 }}>국토교통부 실거래가 조회 중…</p>
        <p style={{ fontSize: 11, color: '#888' }}>최근 4개월 데이터를 분석합니다.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ background: '#FFF5F5', border: '2px solid #CC1100', borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#CC1100', marginBottom: 4 }}>실거래가 조회에 실패했습니다.</p>
        <p style={{ fontSize: 12, color: '#CC1100' }}>{errorMessage || '잠시 후 다시 시도하거나 API 키를 확인해주세요.'}</p>
      </div>
    );
  }

  /* ── idle 상태 ── */
  if (status === 'idle' || !result) {
    return (
      <div style={{ border: '2px solid #E0E0E0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '14px 16px 12px', background: '#F8F8F8', borderBottom: '2px solid #E0E0E0' }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>수치 분석 전 · 체크리스트 기준</div>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: '#111', margin: 0 }}>
            {checkedCount === 0 ? '체크리스트를 시작하면 분석이 여기에 쌓입니다' : `${checkedCount}개 항목 확인 완료 — 핵심 항목 점검 현황`}
          </h2>
        </div>
        <ChecklistAnalysis
          checkedIds={effectiveCheckedIds}
          totalChecks={totalChecks}
          onBackToGuide={onBackToGuide}
        />
      </div>
    );
  }

  /* ── 결과 있음 (success / noData) ── */
  const riskColors: Record<string, { border: string; bg: string }> = {
    blue:   { border: '#009688', bg: '#EDFAF7' },
    yellow: { border: '#E6A000', bg: '#FFFBF0' },
    red:    { border: '#CC1100', bg: '#FFF5F5' },
    gray:   { border: '#999',    bg: '#F5F5F5' },
  };
  const { border, bg } = riskColors[result.riskLevel] ?? riskColors.gray;
  const isSafe   = result.riskLevel === 'blue';
  const isYellow = result.riskLevel === 'yellow';
  const isRed    = result.riskLevel === 'red';

  const safePoints = buildSafePoints(result);
  const refMedian = result.jeonseCount >= 3 ? result.medianJeonseDeposit : result.medianAllDeposit;

  const levelLabel = isSafe ? '안전' : isYellow ? '주의' : isRed ? '위험' : '자료 부족';

  return (
    <div style={{ border: `2px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>

      {/* 헤더 — 위험도 표지판 없이 텍스트만 */}
      <div style={{ padding: '16px 18px', background: bg, borderBottom: `2px solid ${border}` }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: border, marginBottom: 6 }}>
          분석 결과 · {levelLabel}
          {result.status === 'noData' && <span style={{ marginLeft: 8, fontWeight: 700, color: '#999' }}>— 실거래 데이터 부족</span>}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 900, color: '#111', lineHeight: '26pt', margin: '0 0 8px' }}>{result.riskTitle}</h2>
        <p style={{ fontSize: 12, color: '#555', lineHeight: '20pt', margin: 0 }}>{result.riskMessage}</p>
      </div>

      {/* 안전하다고 볼 수 있는 근거 (blue) */}
      {isSafe && safePoints.length > 0 && (
        <div style={{ padding: 16, borderBottom: '1px solid #E0E0E0', background: '#fff' }}>
          <SectionLabel marker="✓" color="#009688" label="안전하다고 볼 수 있는 근거" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {safePoints.map((pt, i) => <SafePointCard key={i} point={pt} />)}
          </div>
        </div>
      )}

      {/* 안전한 편이라고 볼 수 있는 근거 + 주의가 필요한 이유 (yellow) */}
      {isYellow && (
        <>
          {result.riskFactors.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid #E0E0E0', background: '#fff' }}>
              <SectionLabel marker="⚠" color="#E6A000" label={`주의가 필요한 이유 ${result.riskFactors.length}가지`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.riskFactors.map(f => <RiskFactorCard key={f.id} factor={f} />)}
              </div>
            </div>
          )}
          {safePoints.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid #E0E0E0', background: '#fff' }}>
              <SectionLabel marker="·" color="#888" label="안전한 편이라고 볼 수 있는 근거" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {safePoints.map((pt, i) => <SafePointCard key={i} point={pt} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* 위험하다고 판단한 이유 (red) */}
      {isRed && (
        <>
          {result.riskFactors.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid #E0E0E0', background: '#fff' }}>
              <SectionLabel marker="!" color="#CC1100" label={`위험하다고 판단한 이유 ${result.riskFactors.length}가지`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.riskFactors.map(f => <RiskFactorCard key={f.id} factor={f} />)}
              </div>
            </div>
          )}
          {safePoints.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid #E0E0E0', background: '#fff' }}>
              <SectionLabel marker="·" color="#888" label="그나마 다행인 부분" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {safePoints.map((pt, i) => <SafePointCard key={i} point={pt} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* 핵심 수치 */}
      {result.status === 'success' && (
        <div style={{ padding: 16, borderBottom: '1px solid #E0E0E0', background: '#fff' }}>
          <SectionLabel marker="수치" color="#555" label="분석에 사용된 핵심 수치" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatBox label="내 보증금" value={formatWon(result.userDeposit)} />
            <StatBox
              label={result.jeonseCount >= 3 ? `주변 전세 중앙값 (${result.jeonseCount}건)` : `주변 전체 중앙값 (${result.transactionCount}건)`}
              value={formatWon(refMedian ?? 0)}
            />
            {result.depositRatio !== null && (
              <StatBox
                label="주변 시세 대비"
                value={`${result.depositRatio}%`}
                sub={result.depositRatio > 100 ? `시세보다 +${result.depositRatio - 100}% 높음` : '시세 이하 또는 동일'}
                highlight={result.depositRatio >= 130}
              />
            )}
            {result.jeonseRate !== null && (
              <StatBox
                label="전세가율 (보증금 ÷ 집값)"
                value={`${result.jeonseRate}%`}
                sub={result.jeonseRate >= 80 ? '위험 수준' : result.jeonseRate >= 70 ? '주의 수준' : '안전 수준'}
                highlight={result.jeonseRate >= 80}
              />
            )}
          </div>
        </div>
      )}

      {/* 이 결과가 나온 근거 */}
      <div style={{ padding: 16, background: '#fff' }}>
        <SectionLabel marker="근거" color="#777" label="이 결과가 나온 근거" />
        <ul style={{ listStyle: 'none', margin: '0 0 8px', background: '#FAFAFA', borderRadius: 8, padding: '12px 14px', border: '1px solid #E8E8E8', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.reasonSummary.map((r, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555', lineHeight: '20pt' }}>
              <span style={{ color: '#bbb', flexShrink: 0 }}>·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {result.searchedMonths.length > 0 && (
          <p style={{ fontSize: 11, color: '#bbb', marginTop: 6, marginBottom: 0 }}>
            조회 기간: {result.searchedMonths.map(m => formatYm(m)).join(' / ')} · 거래 {result.transactionCount}건
          </p>
        )}
        {onBackToGuide && (
          <p style={{ fontSize: 11, color: '#888', marginTop: 10, lineHeight: '18pt' }}>
            계약 전 추가 확인 목록과 질문·특약 예시는 체크리스트 화면의 <b>부록</b>에서 확인하세요.{' '}
            <button onClick={onBackToGuide} style={{ color: '#009688', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              체크리스트로 →
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
