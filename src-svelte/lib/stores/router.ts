import { writable, derived } from 'svelte/store';

export type AppView = 'dashboard' | 'models' | 'research' | 'research-lab' | 'network' | 'model-detail' | 'protocol' | 'ontology' | 'pipeline';

/** Params carried between routes (e.g. topic from Dashboard → Research) */
export interface RouteParams {
  topic?: string;
  modelId?: string;
}

const ROUTE_MAP: Record<string, AppView> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/models': 'models',
  '/research': 'research',
  '/research-lab': 'research-lab',
  '/semantic-zoom': 'research-lab',
  '/autoresearch': 'research', // legacy redirect
  '/magnet': 'research',       // alias
  '/network': 'network',
  '/model-detail': 'model-detail',
  '/protocol': 'protocol',
  '/economics': 'protocol',    // legacy redirect
  '/ontology': 'ontology',
  '/pipeline': 'pipeline',
};

const VIEW_TO_HASH: Record<AppView, string> = {
  dashboard: '/',
  models: '/models',
  research: '/research',
  'research-lab': '/research-lab',
  network: '/network',
  'model-detail': '/model-detail',
  protocol: '/protocol',
  ontology: '/ontology',
  pipeline: '/pipeline',
};

function getViewFromHash(): AppView {
  const hash = window.location.hash.slice(1) || '/';
  // strip query params for matching
  const path = hash.split('?')[0];
  return ROUTE_MAP[path] ?? 'dashboard';
}

function getParamsFromHash(): RouteParams {
  const hash = window.location.hash.slice(1) || '/';
  const qIdx = hash.indexOf('?');
  if (qIdx < 0) return {};
  const search = new URLSearchParams(hash.slice(qIdx + 1));
  const params: RouteParams = {};
  if (search.has('topic')) params.topic = search.get('topic')!;
  if (search.has('modelId')) params.modelId = search.get('modelId')!;
  return params;
}

function createRouter() {
  const view = writable<AppView>(getViewFromHash());
  const params = writable<RouteParams>(getParamsFromHash());

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      view.set(getViewFromHash());
      params.set(getParamsFromHash());
    });
  }

  function navigate(target: AppView, p?: RouteParams) {
    let hash = VIEW_TO_HASH[target];
    if (p) {
      const qs = new URLSearchParams();
      if (p.topic) qs.set('topic', p.topic);
      if (p.modelId) qs.set('modelId', p.modelId);
      const str = qs.toString();
      if (str) hash += '?' + str;
    }
    window.location.hash = hash;
    view.set(target);
    if (p) params.set(p);
  }

  return {
    subscribe: view.subscribe,
    navigate,
    params: { subscribe: params.subscribe },
  };
}

export const router = createRouter();
