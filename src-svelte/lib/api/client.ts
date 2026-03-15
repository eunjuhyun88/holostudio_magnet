import type {
  RuntimeMeshSummary,
  RuntimeJobCommand,
  RuntimeMeshEvent,
  ModelRecord,
  RewardEntry,
  RewardSummary,
  DashboardData,
  DashboardEvent,
  ActiveBond,
  BondTier,
  BurnConversion,
  ProtocolEvent,
  FlowNode,
  PpapStage,
} from '@mesh/contracts';

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

export function subscribeRuntimeMesh(options: {
  apiBase?: string | null;
  runtimeRoot?: string | null;
  onSnapshot: (mesh: RuntimeMeshSummary) => void;
  onError?: (error: Error) => void;
}): () => void {
  const apiBase = normalizeRuntimeApiBase(options.apiBase);
  const url = new URL('/api/runtime/mesh/events', `${apiBase}/`);
  if (options.runtimeRoot?.trim()) {
    url.searchParams.set('runtimeRoot', options.runtimeRoot.trim());
  }

  const source = new EventSource(url.toString());

  const handleEvent = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as RuntimeMeshSummary | RuntimeMeshEvent;
      options.onSnapshot('mesh' in payload ? payload.mesh : payload);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  source.addEventListener('snapshot', handleEvent as EventListener);
  source.addEventListener('mesh.updated', handleEvent as EventListener);
  source.onerror = () => {
    options.onError?.(new Error('runtime mesh stream disconnected'));
  };

  return () => {
    source.close();
  };
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

/* ─── Domain API Client ─── */

async function fetchJson<T>(apiBase: string, path: string): Promise<T> {
  const base = normalizeRuntimeApiBase(apiBase);
  const response = await fetch(`${base}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${path} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

// Models
export async function fetchModels(apiBase: string): Promise<ModelRecord[]> {
  return fetchJson<ModelRecord[]>(apiBase, '/api/models');
}

export async function fetchModel(apiBase: string, modelId: string): Promise<ModelRecord> {
  return fetchJson<ModelRecord>(apiBase, `/api/models/${encodeURIComponent(modelId)}`);
}

// Protocol
export async function fetchProtocolSummary(apiBase: string) {
  return fetchJson<{
    bondTiers: BondTier[];
    activeBonds: ActiveBond[];
    burnConversions: BurnConversion[];
    ppapStages: PpapStage[];
    flowNodes: FlowNode[];
    balance: number;
    mauTarget: number;
    trustScoreTarget: number;
  }>(apiBase, '/api/protocol/summary');
}

export async function fetchProtocolBonds(apiBase: string): Promise<ActiveBond[]> {
  return fetchJson<ActiveBond[]>(apiBase, '/api/protocol/bonds');
}

export async function fetchProtocolEvents(apiBase: string): Promise<ProtocolEvent[]> {
  return fetchJson<ProtocolEvent[]>(apiBase, '/api/protocol/events');
}

// Rewards
export async function fetchRewards(apiBase: string): Promise<RewardEntry[]> {
  return fetchJson<RewardEntry[]>(apiBase, '/api/rewards');
}

export async function fetchRewardSummary(apiBase: string): Promise<RewardSummary> {
  return fetchJson<RewardSummary>(apiBase, '/api/rewards/summary');
}

// Dashboard
export async function fetchDashboardSummary(apiBase: string): Promise<DashboardData> {
  return fetchJson<DashboardData>(apiBase, '/api/dashboard/summary');
}

export async function fetchDashboardEvents(apiBase: string): Promise<DashboardEvent[]> {
  return fetchJson<DashboardEvent[]>(apiBase, '/api/dashboard/events');
}
