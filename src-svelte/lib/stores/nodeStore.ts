/**
 * nodeStore.ts — Tracks the user's GPU node registration status.
 *
 * Demo mode: pre-populated with a sample node.
 * Connected mode: would fetch from /api/nodes/me.
 */

import { writable, derived, get } from 'svelte/store';
import { wallet } from './walletStore.ts';
import type { BondTier } from '../../../packages/contracts/src/index.ts';

export interface NodeState {
  /** Whether user has at least one registered node */
  hasActiveNode: boolean;
  /** Node identifier */
  nodeId: string;
  /** GPU model name */
  gpuModel: string;
  /** VRAM in GB */
  vramGb: number;
  /** Bond tier (1/2/3) */
  tier: number;
  /** HOOT bonded */
  bondAmount: number;
  /** Trust score (0-1000) */
  trustScore: number;
  /** Jobs completed */
  jobsCompleted: number;
  /** Total earnings (HOOT) */
  totalEarnings: number;
  /** PoAW blocks contributed */
  poawBlocks: number;
  /** Node online status */
  online: boolean;
  /** GPU utilization % */
  utilization: number;
}

const EMPTY_NODE: NodeState = {
  hasActiveNode: false,
  nodeId: '',
  gpuModel: '',
  vramGb: 0,
  tier: 0,
  bondAmount: 0,
  trustScore: 0,
  jobsCompleted: 0,
  totalEarnings: 0,
  poawBlocks: 0,
  online: false,
  utilization: 0,
};

const DEMO_NODE: NodeState = {
  hasActiveNode: true,
  nodeId: 'seoul-4090',
  gpuModel: 'NVIDIA RTX 4090',
  vramGb: 24,
  tier: 2,
  bondAmount: 2000,
  trustScore: 487,
  jobsCompleted: 47,
  totalEarnings: 4.2,
  poawBlocks: 12,
  online: true,
  utilization: 67,
};

function createNodeStore() {
  const { subscribe, set, update } = writable<NodeState>(EMPTY_NODE);

  return {
    subscribe,

    /** Initialize — load demo data if wallet connected */
    init() {
      const w = get(wallet);
      if (w.connected) {
        set({ ...DEMO_NODE });
      }
    },

    /** Register a new node (demo simulation) */
    registerNode(opts: { gpuModel: string; vramGb: number; tier: number; bondAmount: number }) {
      set({
        hasActiveNode: true,
        nodeId: `node-${Math.random().toString(36).slice(2, 6)}`,
        gpuModel: opts.gpuModel,
        vramGb: opts.vramGb,
        tier: opts.tier,
        bondAmount: opts.bondAmount,
        trustScore: 100,
        jobsCompleted: 0,
        totalEarnings: 0,
        poawBlocks: 0,
        online: true,
        utilization: 0,
      });
    },

    /** Update node state */
    updateNode(partial: Partial<NodeState>) {
      update(s => ({ ...s, ...partial }));
    },

    /** Reset on disconnect */
    reset() {
      set({ ...EMPTY_NODE });
    },
  };
}

export const nodeStore = createNodeStore();

/** Derived: does the user have a GPU node? */
export const hasGpuNode = derived(nodeStore, $n => $n.hasActiveNode);
