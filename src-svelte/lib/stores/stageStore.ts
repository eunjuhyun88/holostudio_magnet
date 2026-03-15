import { writable, derived } from 'svelte/store';
import type { AppView } from './router.ts';

export type DisclosureStage = 1 | 2 | 3 | 4 | 5;

/** Which pages are visible at each stage */
const STAGE_PAGES: Record<DisclosureStage, AppView[]> = {
  1: ['studio'],
  2: ['studio', 'research-lab'],
  3: ['studio', 'research-lab', 'models', 'model-detail'],
  4: ['studio', 'research-lab', 'models', 'model-detail', 'network'],
  5: ['studio', 'research-lab', 'models', 'model-detail', 'network', 'protocol', 'pipeline'],
};

/** Read initial stage from localStorage, default to 5 (all pages visible) */
function getInitialStage(): DisclosureStage {
  if (typeof window === 'undefined') return 5;
  const stored = localStorage.getItem('hoot-stage');
  if (stored) {
    const n = Number(stored);
    if (n >= 1 && n <= 5) return n as DisclosureStage;
  }
  return 5;
}

function createStageStore() {
  const { subscribe, set, update } = writable<DisclosureStage>(getInitialStage());

  return {
    subscribe,
    set(stage: DisclosureStage) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('hoot-stage', String(stage));
      }
      set(stage);
    },
    advance() {
      update(s => {
        const next = Math.min(s + 1, 5) as DisclosureStage;
        if (typeof window !== 'undefined') {
          localStorage.setItem('hoot-stage', String(next));
        }
        return next;
      });
    },
  };
}

export const stage = createStageStore();

/** Derived: list of currently unlocked pages */
export const unlockedPages = derived(stage, $s => STAGE_PAGES[$s]);

/** Check if a specific page is unlocked */
export const isPageUnlocked = derived(stage, $s => {
  const pages = STAGE_PAGES[$s];
  return (view: AppView) => pages.includes(view);
});
