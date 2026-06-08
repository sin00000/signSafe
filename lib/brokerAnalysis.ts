/**
 * 중개사무소 분석
 *
 * 데이터 특성:
 * - 국토부 중개사무소 등록현황 API는 시군구별 통계 데이터 (개별 조회 불가)
 * - 개별 사무소 확인은 사용자가 직접 조회해야 함
 * - 이 모듈은 해당 지역 통계 제공 + 확인 방법 안내를 담당
 */
import { RiskSignal } from '@/types/rent';
import { warning, unknown } from './riskSignals';
import { getLawdName } from './lawdCodeMap';

export interface BrokerStats {
  siDoNm: string;
  siGunGuNm: string;
  total: number;
  licensed: number;  // 공인중개사
  corporate: number; // 법인
  branches: number;  // 분사무소
}

/** odcloud JSON → BrokerStats 파싱 */
export function parseBrokerStats(raw: unknown): BrokerStats[] {
  try {
    const obj = raw as Record<string, unknown>;
    const data = obj?.data as Record<string, unknown>[] | undefined;
    if (!data?.length) return [];
    return data.map(item => ({
      siDoNm:    String(item['시도명'] ?? ''),
      siGunGuNm: String(item['시군구명'] ?? ''),
      total:     Number(item['계'] ?? 0),
      licensed:  Number(item['공인중개사'] ?? 0),
      corporate: Number(item['법인'] ?? 0),
      branches:  Number(item['분사무소'] ?? 0),
    }));
  } catch { return []; }
}

/** 해당 구의 통계 찾기 */
export function findDistrictStats(
  stats: BrokerStats[],
  lawdCd: string,
): BrokerStats | null {
  const guName = getLawdName(lawdCd); // 예: "마포구"
  return stats.find(s => s.siGunGuNm.includes(guName) || guName.includes(s.siGunGuNm)) ?? null;
}

/** 중개사 위험 분석 */
export function analyzeBrokerRisk(
  stats: BrokerStats[],
  lawdCd: string | null | undefined,
  brokerNameInput: string | undefined,
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // ── 지역 통계 조회 ─────────────────────────────────────────
  if (lawdCd) {
    const district = findDistrictStats(stats, lawdCd);
    if (district) {
      // 통계는 있지만 개별 확인을 유도
      signals.push(warning(
        'broker_individual_check_needed', 'broker',
        '중개사무소 등록 여부를 직접 확인해야 합니다',
        `${district.siDoNm} ${district.siGunGuNm}에는 총 ${district.total}개의 중개사무소가 등록되어 있습니다. ` +
        `이 중 공인중개사 ${district.licensed}명, 법인 ${district.corporate}개입니다. ` +
        `단, 특정 사무소의 등록 여부는 아래 방법으로 직접 확인해야 합니다.`,
        `${district.siGunGuNm} 등록 현황: 총 ${district.total}개소 (2025년 기준)`,
        '한국공인중개사협회(www.kar.or.kr) → 중개사무소 조회, 또는 국토교통부 정부24에서 "공인중개사 조회"를 검색해 확인하세요.',
        '중개사무소 등록현황 API (시군구 통계)',
      ));
    } else {
      signals.push(unknown(
        'broker_stats_unavailable', 'broker',
        '해당 지역의 중개사무소 통계를 찾을 수 없습니다',
        '입력한 지역 코드와 매칭되는 통계 데이터가 없습니다.',
        `lawdCd: ${lawdCd}`,
        '한국공인중개사협회(www.kar.or.kr)에서 직접 중개사무소를 조회하세요.',
        '중개사무소 등록현황 API',
      ));
    }
  }

  // ── 개별 사무소 확인 유도 ────────────────────────────────────
  if (brokerNameInput) {
    signals.push(warning(
      'broker_name_not_verified', 'broker',
      `"${brokerNameInput}" 중개사무소의 등록 여부를 직접 확인해야 합니다`,
      '이 서비스는 개별 중개사무소 이름으로 등록 여부를 자동 조회할 수 없습니다. 미등록 중개인을 통한 계약은 법적 보호를 받기 어렵습니다.',
      `입력 사무소명: ${brokerNameInput}`,
      `한국공인중개사협회(www.kar.or.kr) → 중개사무소 찾기에서 "${brokerNameInput}"을 검색하거나, 중개사 신분증의 QR코드를 스캔해 확인하세요.`,
      '사용자 입력',
    ));
  } else if (!brokerNameInput && !lawdCd) {
    // 아무 정보도 없을 때 — 중개사 확인 필요성 안내
    signals.push(unknown(
      'broker_not_provided', 'broker',
      '중개사무소 정보가 입력되지 않았습니다',
      '계약을 도와주는 중개사무소가 정식 등록된 곳인지 확인해야 합니다.',
      '미입력',
      '한국공인중개사협회(www.kar.or.kr) 또는 정부24에서 중개사무소명을 검색해 등록 여부를 확인하세요.',
      '사용자 입력',
    ));
  }

  return signals;
}
