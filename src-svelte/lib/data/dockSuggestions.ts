/**
 * dockSuggestions.ts — Context-aware suggestion chips for AgentDock
 *
 * Chips change based on the current research lifecycle phase:
 * - idle: preset shortcuts for quick research launch
 * - running: progress view + stop control
 * - complete: result actions (view, improve, retry, deploy)
 */

export interface SuggestionChip {
  label: string;
  presetId?: string;
  action?: string;
  variant?: 'default' | 'primary' | 'danger';
}

export const IDLE_CHIPS: SuggestionChip[] = [
  { label: 'Crypto Prediction', presetId: 'crypto_market' },
  { label: 'DeFi Risk', presetId: 'defi_risk' },
  { label: 'Fraud Detection', presetId: 'fraud_detection' },
  { label: 'Time Series', presetId: 'time_series' },
];

export const RUNNING_CHIPS: SuggestionChip[] = [
  { label: 'View Progress →', action: 'viewRunning' },
  { label: 'Stop', action: 'stop', variant: 'danger' },
];

export const COMPLETE_CHIPS: SuggestionChip[] = [
  { label: 'View Results →', action: 'viewResults' },
  { label: 'Improve', action: 'improve' },
  { label: 'Retry', action: 'retry' },
  { label: 'Deploy', action: 'deploy', variant: 'primary' },
];
