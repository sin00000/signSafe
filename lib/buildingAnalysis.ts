import { RiskSignal, BuildingInfo, PropertyType } from '@/types/rent';
import { critical, warning, safe, unknown } from './riskSignals';

const RESIDENTIAL_USAGES = [
  '아파트', '연립주택', '다세대주택', '단독주택', '다가구주택',
  '오피스텔', '기숙사', '다중주택',
];

export function analyzeBuildingRisk(
  building: BuildingInfo | null,
  propertyType: PropertyType,
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (!building) {
    signals.push(unknown(
      'building_data_unavailable', 'building',
      '건축물대장 조회 결과가 없습니다',
      '건축물대장을 조회할 수 없어 위반건축물 여부와 건물 용도를 확인하지 못했습니다.',
      '건축물대장 API 조회 불가',
      '정부24(www.gov.kr)에서 건축물대장을 직접 발급받아 확인하세요.',
      '건축물대장 API',
    ));
    return signals;
  }

  // ── 위반건축물 ──────────────────────────────────────────
  if (building.violationBuilding) {
    signals.push(critical(
      'violation_building', 'building',
      '위반건축물입니다',
      '건축물대장에 위반건축물로 표시되어 있습니다. 위반건축물은 전세보증보험 가입이 불가하고, 철거 명령이 내려질 경우 거주 자체가 불가능해질 수 있습니다.',
      `건축물대장 위반건축물여부: Y / 주소: ${building.address}`,
      '이 집을 계약하지 마세요. 위반 사항이 해소되지 않으면 보증금 보호 수단이 없습니다.',
      '건축물대장 API',
    ));
  }

  // ── 건물 용도 확인 ──────────────────────────────────────
  const usage = building.mainUsage.trim();
  const isResidential = RESIDENTIAL_USAGES.some(r =>
    usage.includes(r) || r.includes(usage)
  );

  if (!isResidential && usage) {
    signals.push(critical(
      'non_residential_usage', 'building',
      `건물 용도가 주거용이 아닙니다 (${usage})`,
      '건축물대장상 용도가 주거용이 아닙니다. 주거용이 아닌 건물은 주택임대차보호법 보호를 받을 수 없고, 전세보증보험 가입도 불가합니다.',
      `건축물대장 주요용도: ${usage}`,
      '이 건물에 전세 계약을 진행하지 마세요.',
      '건축물대장 API',
    ));
  } else if (isResidential) {
    signals.push(safe(
      'residential_usage_confirmed', 'building',
      '건물 용도가 주거용으로 확인됩니다',
      `건축물대장상 주요 용도가 "${usage}"로 주거용 건물입니다.`,
      `건축물대장 주요용도: ${usage}`,
      '용도 확인 완료. 위반건축물 여부도 함께 확인하세요.',
      '건축물대장 API',
    ));
  }

  // ── 건물 노후도 ─────────────────────────────────────────
  const ageYears = Math.floor(building.buildingAgeDays / 365);
  if (ageYears >= 30) {
    signals.push(warning(
      'old_building', 'building',
      `건물 사용 승인 ${ageYears}년 경과`,
      `사용승인일로부터 ${ageYears}년이 지난 건물입니다. 노후 건물은 안전 문제와 함께 보증보험 가입 심사에서 불리할 수 있습니다.`,
      `사용승인일: ${building.approvalDate}`,
      '건물 상태를 직접 확인하고, 전세보증보험 가입 가능 여부를 사전 조회하세요.',
      '건축물대장 API',
    ));
  }

  return signals;
}
