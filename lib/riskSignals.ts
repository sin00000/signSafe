import { RiskSignal, SignalSeverity, SignalCategory } from '@/types/rent';

export function makeSignal(
  id: string,
  severity: SignalSeverity,
  category: SignalCategory,
  title: string,
  description: string,
  evidence: string,
  action: string,
  source: string,
): RiskSignal {
  return { id, category, severity, title, description, evidence, action, source };
}

export const critical = (
  id: string, category: SignalCategory,
  title: string, description: string, evidence: string, action: string, source: string,
): RiskSignal => makeSignal(id, 'critical', category, title, description, evidence, action, source);

export const warning = (
  id: string, category: SignalCategory,
  title: string, description: string, evidence: string, action: string, source: string,
): RiskSignal => makeSignal(id, 'warning', category, title, description, evidence, action, source);

export const safe = (
  id: string, category: SignalCategory,
  title: string, description: string, evidence: string, action: string, source: string,
): RiskSignal => makeSignal(id, 'safe', category, title, description, evidence, action, source);

export const unknown = (
  id: string, category: SignalCategory,
  title: string, description: string, evidence: string, action: string, source: string,
): RiskSignal => makeSignal(id, 'unknown', category, title, description, evidence, action, source);
