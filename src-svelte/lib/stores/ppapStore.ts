/**
 * ppapStore.ts — Tracks user's PPAP data contributions.
 *
 * Actual data contribution happens in Hoot Browser (D6 decision).
 * This store provides status view for Studio and Protocol pages.
 */

import { writable, derived, get } from 'svelte/store';
import { wallet } from './walletStore.ts';

export interface PPAPBatch {
  id: string;
  batchNumber: number;
  status: 'pending' | 'challenged' | 'confirmed' | 'rejected';
  submittedAt: string;
  challengeDeadline?: string;
  reward?: number;
}

export interface PPAPState {
  totalSubmissions: number;
  totalBatches: number;
  confirmedBatches: number;
  pendingBatches: number;
  challengedBatches: number;
  batches: PPAPBatch[];
}

const EMPTY_STATE: PPAPState = {
  totalSubmissions: 0,
  totalBatches: 0,
  confirmedBatches: 0,
  pendingBatches: 0,
  challengedBatches: 0,
  batches: [],
};

const now = Date.now();
const hour = 3600000;
const day = 86400000;

const DEMO_STATE: PPAPState = {
  totalSubmissions: 47,
  totalBatches: 12,
  confirmedBatches: 10,
  pendingBatches: 1,
  challengedBatches: 1,
  batches: [
    { id: 'ppap-2891', batchNumber: 2891, status: 'confirmed', submittedAt: new Date(now - 2 * day).toISOString(), reward: 0.2 },
    { id: 'ppap-2890', batchNumber: 2890, status: 'confirmed', submittedAt: new Date(now - 3 * day).toISOString(), reward: 0.2 },
    { id: 'ppap-2889', batchNumber: 2889, status: 'challenged', submittedAt: new Date(now - 1 * day).toISOString(), challengeDeadline: new Date(now + 12 * hour).toISOString() },
    { id: 'ppap-2888', batchNumber: 2888, status: 'confirmed', submittedAt: new Date(now - 5 * day).toISOString(), reward: 0.2 },
    { id: 'ppap-2887', batchNumber: 2887, status: 'confirmed', submittedAt: new Date(now - 7 * day).toISOString(), reward: 0.2 },
  ],
};

function createPPAPStore() {
  const { subscribe, set, update } = writable<PPAPState>(EMPTY_STATE);

  return {
    subscribe,

    /** Load PPAP status — demo data if wallet connected */
    init() {
      const w = get(wallet);
      if (w.connected) {
        set({ ...DEMO_STATE });
      }
    },

    /** Get the most recent batches */
    getRecentBatches(limit: number = 5): PPAPBatch[] {
      const state = get({ subscribe });
      return state.batches.slice(0, limit);
    },

    /** Reset on disconnect */
    reset() {
      set({ ...EMPTY_STATE });
    },
  };
}

export const ppapStore = createPPAPStore();

/** Derived: number of confirmed PPAPs */
export const confirmedPPAPs = derived(ppapStore, $p => $p.confirmedBatches);
