/**
 * simulationService.ts — Local autoresearch simulation engine.
 *
 * Extracted from jobStore.ts to separate simulation concern from view-store.
 * This service manages experiment generation, training progress, verification
 * pipeline ticks, and the setup-phase animation.
 *
 * The jobStore remains the owner of state, timers, and public API.
 * This service only contains the simulation logic.
 */

import type { AutoresearchJob, Experiment, ExperimentStatus, VerificationState } from '../stores/jobStore.ts';
import { selectModification, generateExperiment, createTrainingExperiment } from '../api/simulationAdapter.ts';
import { capArray } from '../utils/perf.ts';

const MAX_EXPERIMENTS = 500;

/* ─── Dependencies injected by jobStore ─── */

export type SimulationDeps = {
  update: (fn: (state: AutoresearchJob) => AutoresearchJob) => void;
  getState: () => AutoresearchJob;
  addTimer: (t: ReturnType<typeof setTimeout | typeof setInterval>) => void;
  clearAllTimers: () => void;
};

/* ─── Setup Phase ─── */

export function runSetupPhase(topic: string, deps: SimulationDeps, onComplete: () => void): void {
  const messages = [
    `Analyzing research domain: "${topic}"...`,
    'Generating program.md with Claude...',
    'Configuring train.py template...',
    'Setting up evaluation pipeline...',
    'Distributing to compute nodes...',
    'Starting first experiments...',
  ];
  let idx = 0;

  const interval = setInterval(() => {
    if (idx >= messages.length) {
      clearInterval(interval);
      deps.update(s => ({ ...s, phase: 'running', setupMessage: '' }));
      onComplete();
      return;
    }
    deps.update(s => ({ ...s, setupMessage: messages[idx] }));
    idx++;
  }, 350);
  deps.addTimer(interval);
}

/* ─── Main Simulation Loop ─── */

export function runSimulationLoop(deps: SimulationDeps): void {
  let nextId = 1;
  let trainingId: number | null = null;

  // First experiment: training baseline
  const firstExp = createTrainingExperiment(nextId++, 1, 'baseline model (initial run)');
  trainingId = firstExp.id;
  deps.update(s => ({ ...s, experiments: [firstExp] }));

  // Single merged tick: clock + progress + verification (1000ms)
  const combinedTick = setInterval(() => {
    // Clock: increment elapsed time
    deps.update(s => ({ ...s, elapsedSeconds: s.elapsedSeconds + 3 }));
    deps.update(s => {
      let changed = false;
      const now = Date.now();
      const exps = s.experiments.map(e => {
        // Progress: advance training experiments
        if (e.id === trainingId && e.status === 'training') {
          changed = true;
          const newProgress = Math.min(100, e.progress + 24 + Math.random() * 30);
          if (newProgress >= 100) {
            const metric = 1.4 + Math.random() * 0.3;
            trainingId = null;
            return {
              ...e,
              status: 'keep' as ExperimentStatus,
              progress: 100,
              metric: Math.round(metric * 1000) / 1000,
              delta: 0,
              duration: Math.round(280 + Math.random() * 40),
            };
          }
          return { ...e, progress: newProgress };
        }
        // Verification: advance commit-reveal pipeline
        if (e.status !== 'training') {
          const age = now - e.timestamp;
          if (e.verification === 'pending' && age > 800) {
            changed = true;
            return { ...e, verification: 'committed' as VerificationState };
          }
          if (e.verification === 'committed' && age > 1400) {
            changed = true;
            return { ...e, verification: 'revealed' as VerificationState };
          }
          if (e.verification === 'revealed' && age > 1900) {
            changed = true;
            const isSpotChecked = Math.random() < 0.2;
            return { ...e, verification: (isSpotChecked ? 'spot-checked' : 'verified') as VerificationState };
          }
        }
        return e;
      });
      if (!changed) return s;
      const capped = capArray(exps, MAX_EXPERIMENTS);
      const keeps = capped.filter(e => e.status === 'keep');
      const best = keeps.length > 0 ? Math.min(...keeps.map(k => k.metric)) : s.bestMetric;
      const newBaseline = s.baselineMetric === Infinity && keeps.length > 0
        ? keeps[keeps.length - 1].metric : s.baselineMetric;
      return { ...s, experiments: capped, bestMetric: best === Infinity ? s.bestMetric : best, baselineMetric: newBaseline };
    });
  }, 1000);
  deps.addTimer(combinedTick);

  // Experiment scheduling loop
  function scheduleNext() {
    const delay = 500 + Math.random() * 700;
    const timer = setTimeout(() => {
      const state = deps.getState();
      if (state.phase !== 'running') return;
      if (state.paused) { scheduleNext(); return; }

      const doneCount = state.experiments.filter(
        e => e.status === 'keep' || e.status === 'discard' || e.status === 'crash'
      ).length;
      if (doneCount >= state.totalExperiments) {
        deps.update(s => ({ ...s, phase: 'complete' }));
        deps.clearAllTimers();
        return;
      }

      const available = state.branches.filter(b => b.completed < b.total);
      if (available.length === 0) {
        deps.update(s => ({ ...s, phase: 'complete' }));
        deps.clearAllTimers();
        return;
      }

      const branch = available[Math.floor(Math.random() * available.length)];

      if (trainingId === null && Math.random() < 0.25) {
        const mod = selectModification(state.experiments, state.boostedCategories, state.pausedCategories);
        const trainExp = createTrainingExperiment(nextId++, branch.id, mod);
        trainingId = trainExp.id;
        deps.update(s => ({ ...s, experiments: capArray([trainExp, ...s.experiments], MAX_EXPERIMENTS) }));
        scheduleNext();
        return;
      }

      const newExp = generateExperiment(
        nextId++, branch.id, state.bestMetric, state.experiments,
        state.boostedCategories, state.pausedCategories,
      );

      deps.update(s => {
        const exps = capArray([newExp, ...s.experiments], MAX_EXPERIMENTS);
        const updatedBranches = s.branches.map(b => {
          if (b.id !== branch.id) return b;
          const newBest = newExp.status === 'keep' && newExp.metric < b.bestMetric
            ? newExp.metric : b.bestMetric;
          return { ...b, completed: b.completed + 1, bestMetric: newBest };
        });
        const newBest = newExp.status === 'keep' && newExp.metric < s.bestMetric
          ? newExp.metric : s.bestMetric;
        return { ...s, experiments: exps, branches: updatedBranches, bestMetric: newBest };
      });

      scheduleNext();
    }, delay);
    deps.addTimer(timer);
  }

  const kickoff = setTimeout(() => scheduleNext(), 1200);
  deps.addTimer(kickoff);
}
