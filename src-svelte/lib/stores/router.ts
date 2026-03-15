import { writable, derived } from 'svelte/store';

export type AppView = 'studio' | 'dashboard' | 'models' | 'research' | 'research-lab' | 'network' | 'model-detail' | 'protocol' | 'ontology' | 'pipeline';

/** Params carried between routes (e.g. topic from Dashboard → Research) */
export interface RouteParams {
  topic?: string;
  modelId?: string;
  jobId?: string;
  tab?: string;  // sub-tab within a page (e.g. 'rewards', 'my-nodes')
}

const ROUTE_MAP: Record<string, AppView> = {
  '/': 'studio',
  '/studio': 'studio',
  '/dashboard': 'studio',          // legacy → studio
  '/models': 'models',
  '/research': 'research',         // still accessible, absorbed into studio in Phase 4
  '/research-lab': 'research-lab',
  '/semantic-zoom': 'research-lab',
  '/autoresearch': 'studio',       // legacy → studio
  '/magnet': 'studio',             // legacy → studio
  '/network': 'network',
  '/model-detail': 'model-detail',
  '/protocol': 'protocol',
  '/economics': 'protocol',        // legacy → protocol
  '/ontology': 'ontology',         // still accessible, absorbed into studio in Phase 4
  '/pipeline': 'pipeline',
};

const VIEW_TO_HASH: Record<AppView, string> = {
  studio: '/',
  dashboard: '/',              // legacy alias → same as studio
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
  return ROUTE_MAP[path] ?? 'studio';
}

function getParamsFromHash(): RouteParams {
  const hash = window.location.hash.slice(1) || '/';
  const qIdx = hash.indexOf('?');
  if (qIdx < 0) return {};
  const search = new URLSearchParams(hash.slice(qIdx + 1));
  const params: RouteParams = {};
  if (search.has('topic')) params.topic = search.get('topic')!;
  if (search.has('modelId')) params.modelId = search.get('modelId')!;
  if (search.has('jobId')) params.jobId = search.get('jobId')!;
  if (search.has('tab')) params.tab = search.get('tab')!;
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
      if (p.jobId) qs.set('jobId', p.jobId);
      if (p.tab) qs.set('tab', p.tab);
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
