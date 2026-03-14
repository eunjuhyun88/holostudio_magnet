import type {
  RuntimeMeshSummary,
  RuntimeJobCommand,
} from '../../../packages/contracts/src/index.ts';

/* ─── URL Normalization ─── */

export function normalizeRuntimeApiBase(input?: string | null): string {
  const raw = input?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8790';
    }
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:8790';
}

/* ─── Runtime Config Detection ─── */

export interface RuntimeConfig {
  runtimeRoot: string | null;
  apiBase: string | null;
}

export function readRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return { runtimeRoot: null, apiBase: null };

  const params = new URLSearchParams(window.location.search);
  const hashParams = window.location.hash.includes('?')
    ? new URLSearchParams(window.location.hash.split('?')[1])
    : null;

  return {
    runtimeRoot: params.get('runtimeRoot') ?? hashParams?.get('runtimeRoot') ?? null,
    apiBase: params.get('apiBase') ?? hashParams?.get('apiBase') ?? null,
  };
}

/* ─── API Client ─── */

export async function fetchRuntimeMesh(options: {
  apiBase?: string | null;
  runtimeRoot?: string | null;
}): Promise<RuntimeMeshSummary> {
  const apiBase = normalizeRuntimeApiBase(options.apiBase);
  const url = new URL('/api/runtime/mesh', `${apiBase}/`);
  if (options.runtimeRoot?.trim()) {
    url.searchParams.set('runtimeRoot', options.runtimeRoot.trim());
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`runtime mesh request failed (${response.status})`);
  }
  return response.json() as Promise<RuntimeMeshSummary>;
}

export async function sendRuntimeCommand(options: {
  apiBase: string;
  runtimeRoot?: string | null;
  command: RuntimeJobCommand;
}): Promise<RuntimeMeshSummary['controller']> {
  const url = new URL('/api/runtime/control', `${options.apiBase}/`);
  if (options.runtimeRoot?.trim()) {
    url.searchParams.set('runtimeRoot', options.runtimeRoot.trim());
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(options.command),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : `runtime command request failed (${response.status})`;
    throw new Error(message);
  }

  return (payload?.controller ?? null) as RuntimeMeshSummary['controller'];
}
