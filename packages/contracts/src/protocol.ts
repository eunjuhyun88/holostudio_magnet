/**
 * Protocol domain types — extracted from protocolData.ts
 *
 * Shared between frontend stores and backend API.
 */

export interface BondTier {
  name: string;
  tier: number;
  bondNum: number;
  bond: string;
  gpu: string;
  jobs: string;
  accent: string;
}

export interface ActiveBond {
  nodeId: string;
  tier: string;
  amount: string;
  status: string;
  unbondingDays: number | null;
}

export interface BurnConversion {
  amount: string;
  credit: string;
  tier: string;
  time: string;
}

export interface PpapStage {
  id: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
}

export interface FlowNode {
  id: string;
  label: string;
  amount: string;
  angle: number;
  color: string;
  breakdown: string;
}

export interface ProtocolEvent {
  text: string;
  color: string;
  time: string;
  fn: string;
}

export interface JourneyActor {
  role: string;
  desc: string;
  icon: string;
  color: string;
  actions: string[];
}

export interface ContractCall {
  title: string;
  contract: string;
  fn: string;
  params: { name: string; type: string; value: string }[];
  fee: string;
  gas: string;
  note: string;
  accentColor: string;
  requiresApproval?: boolean;
  /** When true, show HOOT / USDC payment selector in review step */
  paymentEnabled?: boolean;
  /** HOOT amount (base price) — displayed when paymentEnabled */
  hootAmount?: string;
  /** USDC amount (+25% surcharge) — displayed when paymentEnabled */
  usdcAmount?: string;
}
