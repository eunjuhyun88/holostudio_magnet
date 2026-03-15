/**
 * connectionStore.ts — Tracks whether the app runs in demo or connected mode.
 *
 * - 'demo': all data comes from local fixtures (offline-first, default)
 * - 'connected': data fetched from runtime-api (localhost:8790 by default)
 *
 * Both values persist across page reloads via localStorage.
 */

import { writable, derived } from 'svelte/store';

export type ConnectionMode = 'demo' | 'connected';

const STORAGE_KEY_MODE = 'hoot-connection-mode';
const STORAGE_KEY_API = 'hoot-api-base';
const DEFAULT_API_BASE = 'http://localhost:8790';

function readLocalStorage(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function persistLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or private browsing — silently ignore.
  }
}

// ── Stores ──

function createConnectionMode() {
  const initial = readLocalStorage(STORAGE_KEY_MODE, 'demo') as ConnectionMode;
  const { subscribe, set, update } = writable<ConnectionMode>(initial);

  return {
    subscribe,
    set(value: ConnectionMode) {
      persistLocalStorage(STORAGE_KEY_MODE, value);
      set(value);
    },
    toggle() {
      update((current) => {
        const next = current === 'demo' ? 'connected' : 'demo';
        persistLocalStorage(STORAGE_KEY_MODE, next);
        return next;
      });
    },
  };
}

function createApiBase() {
  const initial = readLocalStorage(STORAGE_KEY_API, DEFAULT_API_BASE);
  const { subscribe, set } = writable<string>(initial);

  return {
    subscribe,
    set(value: string) {
      const normalized = value.replace(/\/+$/, '') || DEFAULT_API_BASE;
      persistLocalStorage(STORAGE_KEY_API, normalized);
      set(normalized);
    },
  };
}

export const connectionMode = createConnectionMode();
export const apiBase = createApiBase();

/** true when connected mode — convenient for reactive checks */
export const isConnected = derived(connectionMode, ($mode) => $mode === 'connected');
