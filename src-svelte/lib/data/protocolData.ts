/** Static data for Protocol (Economics) page — extracted from EconomicsPage.svelte */

// ── Types from shared contracts (re-exported for backward compat) ──
export type {
  PpapStage,
  JourneyActor,
  FlowNode,
  ProtocolEvent,
  ContractCall,
  BondTier,
  ActiveBond,
  BurnConversion,
} from '@mesh/contracts';

import type {
  PpapStage,
  JourneyActor,
  FlowNode,
  ProtocolEvent,
} from '@mesh/contracts';

export const BOND_TIERS = [
  { name: 'Lite', tier: 1, bondNum: 500, bond: '500', gpu: '1 GPU', jobs: '5 concurrent', accent: 'var(--blue)' },
  { name: 'Standard', tier: 2, bondNum: 2000, bond: '2,000', gpu: '4 GPUs', jobs: '20 concurrent', accent: 'var(--accent)' },
  { name: 'Enterprise', tier: 3, bondNum: 10000, bond: '10,000', gpu: 'Unlimited', jobs: 'Unlimited', accent: 'var(--gold)' },
] as const;

export const ACTIVE_BONDS = [
  { nodeId: 'seoul-4090', tier: 'Standard', amount: '2,000', status: 'active', unbondingDays: null as number | null },
  { nodeId: 'berlin-a100', tier: 'Enterprise', amount: '10,000', status: 'unbonding', unbondingDays: 4 },
];

export const BURN_CONVERSIONS = [
  { amount: '2,500', credit: '$140.00', tier: 'Pro', time: '2h ago' },
  { amount: '500', credit: '$25.00', tier: 'Basic', time: '1d ago' },
  { amount: '10,000', credit: '$600.00', tier: 'Ultra', time: '3d ago' },
];

export const PPAP_STAGES: PpapStage[] = [
  { id: 'submit', label: 'Submit', sub: 'Contributor uploads data', icon: '📤', color: 'var(--blue)' },
  { id: 'batch', label: 'Batch', sub: 'Aggregated into batch', icon: '📦', color: 'var(--accent)' },
  { id: 'challenge', label: 'Challenge', sub: '24h verification window', icon: '⏱', color: 'var(--gold)' },
  { id: 'confirmed', label: 'Confirmed', sub: 'PPAP immutable on-chain', icon: '✓', color: 'var(--green)' },
];

export const JOURNEY_ACTORS: JourneyActor[] = [
  {
    role: 'Contributor',
    desc: 'Provides data & annotations',
    icon: '📊',
    color: 'var(--accent)',
    actions: ['Upload datasets', 'Earn Pool A rewards', 'Build PPAP provenance'],
  },
  {
    role: 'Verifier',
    desc: 'Validates data integrity',
    icon: '🔍',
    color: 'var(--blue)',
    actions: ['Challenge batches', 'Earn notary fees', 'Maintain trust score'],
  },
  {
    role: 'Compute',
    desc: 'GPU nodes run experiments',
    icon: '⚡',
    color: 'var(--green)',
    actions: ['Bond HOOT as stake', 'Execute research jobs', 'Earn Pool B rewards'],
  },
  {
    role: 'Builder',
    desc: 'Researchers & model creators',
    icon: '🧪',
    color: 'var(--gold)',
    actions: ['Define ontologies', 'Launch Magnet jobs', 'Publish VTR results'],
  },
  {
    role: 'Buyer',
    desc: 'Consumes model outputs',
    icon: '🔑',
    color: 'var(--red)',
    actions: ['Purchase model access', 'Burn HOOT for credits', 'Deploy agent bundles'],
  },
];

export const FLOW_NODES: FlowNode[] = [
  { id: 'poolA', label: 'Pool A', amount: '42%', angle: -45, color: 'var(--accent)', breakdown: 'Creator 60% / Notary 15% / Treasury 15% / Burn 10%' },
  { id: 'poolB', label: 'Pool B', amount: '38%', angle: 45, color: 'var(--green)', breakdown: 'GPU Compute 95% / Treasury 5%' },
  { id: 'burn', label: 'Burn', amount: '12%', angle: 135, color: 'var(--red)', breakdown: 'Permanently removed from supply' },
  { id: 'treasury', label: 'Treasury', amount: '8%', angle: 225, color: 'var(--gold)', breakdown: 'Protocol reserve & insurance' },
];

export const EVENT_FEED: ProtocolEvent[] = [
  { text: 'Node seoul-4090 bonded 2,000 HOOT → Tier 2', color: 'var(--blue)', time: '2m ago', fn: 'registerNode' },
  { text: 'Job job-0042 created → 150 HOOT escrowed', color: 'var(--green)', time: '5m ago', fn: 'createJob' },
  { text: 'VTR registered for exp-441 → 1.0 HOOT burned', color: 'var(--red)', time: '8m ago', fn: 'registerVTR' },
  { text: 'Batch #2891 submitted → 3.0 HOOT fee (2.1 treasury / 0.9 burn)', color: 'var(--gold)', time: '12m ago', fn: 'submitBatch' },
  { text: '1,000 HOOT burned → $50 credit (Pro tier)', color: 'var(--red)', time: '15m ago', fn: 'burnToCredit' },
  { text: 'Pool A settled → 450 HOOT (270 creator / 67.5 notary / 67.5 treasury / 45 burn)', color: 'var(--accent)', time: '18m ago', fn: 'settlePool' },
  { text: 'Challenge resolved → valid, 50 HOOT reward', color: 'var(--green)', time: '22m ago', fn: 'resolveChallenge' },
  { text: 'Node us-a100 unbonded 10,000 HOOT', color: 'var(--blue)', time: '25m ago', fn: 'unbondNode' },
];

export const CONTRACT_MAP: Record<string, string> = {
  registerNode: '0x4F0a...7E3d  HootStaking.sol',
  createJob: '0x5E8c...2B7f  ResearchJobManager.sol',
  registerVTR: '0x7F4b...3D6a  VTRRegistry.sol',
  submitBatch: '0x3A1d...9C2e  PPAPRegistry.sol',
  burnToCredit: '0x8B2c...1A9f  HootBurnCredit.sol',
  settlePool: '0x6C9d...5B3a  PoolDistributor.sol',
  resolveChallenge: '0x9D3f...4A1c  ChallengeArbitration.sol',
  unbondNode: '0x4F0a...7E3d  HootStaking.sol',
};

export const SIMULATED_BALANCE = 12_450;
export const MAU_TARGET = 1443;
export const TRUST_SCORE_TARGET = 847;
