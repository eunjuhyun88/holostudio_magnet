import { derived, writable } from 'svelte/store';
import { jobState } from './jobState.ts';
import { isPaused } from './jobDerived.ts';

export type OwlMood = 'idle' | 'research' | 'build' | 'celebrate' | 'sleep';

/* ── Celebrate flash override ── */

const celebrateOverride = writable(false);
let celebrateTimer: ReturnType<typeof setTimeout> | null = null;

export function flashCelebrate(durationMs = 2500): void {
  if (celebrateTimer) clearTimeout(celebrateTimer);
  celebrateOverride.set(true);
  celebrateTimer = setTimeout(() => {
    celebrateOverride.set(false);
    celebrateTimer = null;
  }, durationMs);
}

/* ── Base mood derived from job phase ── */

const baseMood = derived([jobState, isPaused], ([$job, $paused]): OwlMood => {
  if ($job.phase === 'complete') return 'celebrate';
  if ($job.phase === 'running' && $paused) return 'sleep';
  if ($job.phase === 'running') return 'research';
  if ($job.phase === 'setup') return 'build';
  if ($job.runtimeStatus === 'error') return 'build';
  return 'idle';
});

/* ── Exported mood (override wins while active) ── */

export const owlMood = derived(
  [baseMood, celebrateOverride],
  ([$base, $override]): OwlMood => $override ? 'celebrate' : $base,
);
