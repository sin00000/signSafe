// ── 기본 입력 타입 ────────────────────────────────────────────
export type PropertyType = 'apartment' | 'villa' | 'officetel' | 'detached';
export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'noData' | 'error';

export interface UserInput {
  address: string;
  lawdCd: string | null;
  sigunguCd: string | null;   // 5자리 시군구 코드
  bjdongCd: string | null;    // 5자리 법정동 코드 (동 단위)
  propertyType: PropertyType;
  deposit: number | null;     // 만원
  monthlyRent: number | null; // 만원
  dealYm: string;             // YYYYMM
  brokerName?: string;        // 중개사무소명
  brokerRegNo?: string;       // 등록번호
  // 수동 체크 항목
  isOwnerMatch: boolean | null;
  hasSeizure: boolean | null;
  canRegister: boolean | null;
  canGetFixedDate: boolean | null;
  canInsure: boolean | null;
}

// ── 파싱된 거래 데이터 ─────────────────────────────────────────
export interface RentTransaction {
  deposit: number;      // 원
  monthlyRent: number;  // 원
  area: number;
  buildingName: string;
  year: number;
  month: number;
  floor: number;
  dong: string;
}

export interface SaleTransaction {
  price: number;        // 원
  area: number;
  buildingName: string;
  year: number;
  month: number;
  floor: number;
  dong: string;
}

export interface OfficialPrice {
  price: number;        // 원 (공시가격)
  year: number;
  buildingName?: string;
}

export interface BuildingInfo {
  mainUsage: string;            // 주요용도
  violationBuilding: boolean;   // 위반건축물
  approvalDate: string;         // 사용승인일 (YYYYMMDD)
  buildingAgeDays: number;      // 경과일수
  address: string;
}

export interface BrokerInfo {
  name: string;
  regNo: string;
  status: string;               // 정상/폐업/등록취소 등
  officeAddress: string;
  agentName: string;
}

// ── 위험 신호 ─────────────────────────────────────────────────
export type SignalSeverity = 'critical' | 'warning' | 'safe' | 'unknown';
export type SignalCategory = 'price' | 'building' | 'broker' | 'document' | 'procedure' | 'unknown';

export interface RiskSignal {
  id: string;
  category: SignalCategory;
  severity: SignalSeverity;
  title: string;
  description: string;
  evidence: string;
  action: string;
  source: string;
}

// ── 신호등 판정 ────────────────────────────────────────────────
export type TrafficLight = 'red' | 'yellow' | 'green' | 'gray';

export interface RiskDecision {
  light: TrafficLight;
  headline: string;
  summary: string;
  criticalSignals: RiskSignal[];
  warningSignals: RiskSignal[];
  safeSignals: RiskSignal[];
  unknownSignals: RiskSignal[];
  questions: string[];
  specialTerms: string[];
}

// ── API 레지스트리 ─────────────────────────────────────────────
export type ApiCategory =
  | 'rentPrice' | 'salePrice' | 'officialPrice'
  | 'building' | 'broker' | 'contract' | 'manualCheck';

export interface ApiCallParams {
  lawdCd?: string;
  sigunguCd?: string;
  bjdongCd?: string;
  pnu?: string;
  dealYm?: string;
  propertyType?: PropertyType;
  brokerName?: string;
  brokerRegNo?: string;
  apiKey: string;
  extraKey?: string;
}

export interface ApiDefinition {
  id: string;
  name: string;
  category: ApiCategory;
  propertyTypes: PropertyType[] | 'all';
  requiredParams: string[];
  buildUrl: (params: ApiCallParams) => string | null;
  responseType: 'xml' | 'json';
  enabled: boolean;
}

// ── 하위 호환 타입 (기존 컴포넌트 유지용) ─────────────────────
export type RiskLevel = 'blue' | 'yellow' | 'red' | 'gray';

export interface RiskFactor {
  id: string;
  level: 'red' | 'yellow' | 'blue' | 'gray';
  title: string;
  description: string;
  action: string;
}

export interface FormData {
  address: string;
  lawdCd: string | null;
  bjdongCd: string | null;   // 5자리 법정동 코드 (동 단위)
  dongName: string | null;   // 법정동명 (표시용)
  pnu:            string | null;   // 19자리 필지번호 (번지 포함 주소 입력 시)
  // ── 정밀 분석용 (입력 시 정확도 향상) ──────────────────
  area:                number | null;  // 전용면적 (㎡)
  buildingName:        string;         // 단지명/건물명
  priorTenantDeposit:  number | null;  // 선순위 임차인 보증금 합계 (만원)
  floor:               number | null;  // 층수
  propertyType: PropertyType;
  deposit: number | null;
  monthlyRent: number | null;
  dealYm: string;
  housePrice: number | null;
  mortgageAmount: number | null;
  hasMortgage: boolean | null;
  hasPriorLiens: boolean | null;
  isOwnerMatch: boolean | null;
  canRegister: boolean | null;
  canGetFixedDate: boolean | null;
  canInsure: boolean | null;
}

export interface RentAnalysisResult {
  status: 'success' | 'noData' | 'error';
  propertyType: PropertyType;
  address: string;
  lawdCd: string;
  dealYm: string;
  searchedMonths: string[];
  userDeposit: number;
  userMonthlyRent: number;
  medianJeonseDeposit: number | null;
  averageJeonseDeposit: number | null;
  medianAllDeposit: number | null;
  transactionCount: number;
  jeonseCount: number;
  monthlyRentCount: number;
  depositRatio: number | null;
  jeonseRate: number | null;
  auctionRiskDeposit: number | null;
  isKangtonJeonse: boolean;
  riskLevel: RiskLevel;
  riskTitle: string;
  riskMessage: string;
  riskFactors: RiskFactor[];
  reasonSummary: string[];
  requiredChecks: string[];
  questionsToAsk: string[];
  contractSpecialTerms: string[];
  errorMessage?: string;
}

export interface GlossaryTerm {
  term: string;
  plain: string;
  definition: string;
  whyItMatters: string;
  howToCheck?: string;
  warning?: string;
  category: 'document' | 'money' | 'right' | 'risk' | 'protection';
}
