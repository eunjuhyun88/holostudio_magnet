/**
 * dockStore.ts — Spotlight-style dock expansion state
 *
 * Orchestrates the dock's expansion body and bridges
 * user input to studioStore/jobStore for research lifecycle.
 *
 * Does NOT own research lifecycle — reads from jobStore/studioStore,
 * dispatches actions to them.
 */
import { writable, derived, get } from 'svelte/store';
import { jobStore } from './jobStore.ts';
import { studioStore } from './studioStore.ts';
import { toastStore } from './toastStore.ts';
import { router } from './router.ts';
import {
  createOntologyFromPreset,
  getEnabledBranches,
  getTotalExperiments,
  estimateBudgetHoot,
} from '../data/ontologyData.ts';

// ── Types ──

export type DockExpansion = 'collapsed' | 'expanded';
export type LauncherIntent = 'new' | 'improve' | 'retry';
export type DockContextPhase = 'idle' | 'running' | 'complete';

interface DockState {
  expansion: DockExpansion;
  launcherTopic: string;
  selectedPresetId: string | null;
  intent: LauncherIntent;
}

// ── Initial State ──

const initialState: DockState = {
  expansion: 'collapsed',
  launcherTopic: '',
  selectedPresetId: null,
  intent: 'new',
};

// ── Store ──

function createDockStore() {
  const { subscribe, set, update } = writable<DockState>(initialState);

  return {
    subscribe,

    /** Expand dock with optional topic pre-fill */
    expand(topic?: string, intent: LauncherIntent = 'new') {
      update(s => ({
        ...s,
        expansion: 'expanded',
        launcherTopic: topic ?? s.launcherTopic,
        intent,
        // For improve/retry, keep existing preset; for new, clear
        selectedPresetId: intent === 'new' ? s.selectedPresetId : s.selectedPresetId,
      }));
    },

    /** Collapse dock */
    collapse() {
      update(s => ({ ...s, expansion: 'collapsed' }));
    },

    /** Toggle expansion */
    toggle() {
      update(s => ({
        ...s,
        expansion: s.expansion === 'collapsed' ? 'expanded' : 'collapsed',
      }));
    },

    /** Set launcher topic */
    setTopic(topic: string) {
      update(s => ({ ...s, launcherTopic: topic }));
    },

    /** Select a preset → updates topic + preset ID */
    selectPreset(presetId: string, topic: string) {
      update(s => ({ ...s, selectedPresetId: presetId, launcherTopic: topic }));
    },

    /** Clear preset selection */
    clearPreset() {
      update(s => ({ ...s, selectedPresetId: null }));
    },

    /** Launch research from dock — bypasses STEP1/STEP2 */
    launch() {
      const state = get({ subscribe });
      if (!state.launcherTopic.trim()) return;

      const topic = state.launcherTopic.trim();

      // Calculate branch/iter from ontology
      const ont = state.selectedPresetId
        ? createOntologyFromPreset(state.selectedPresetId)
        : createOntologyFromPreset('balanced');
      const branches = getEnabledBranches(ont).length;
      const totalExp = getTotalExperiments(ont);
      const itersPerBranch = Math.round(totalExp / Math.max(branches, 1));

      // Execute
      jobStore.startJob(topic, branches, itersPerBranch);
      studioStore.launchFromDock(topic, state.selectedPresetId ?? undefined);
      toastStore.success('Research started');

      // Collapse dock
      update(s => ({ ...s, expansion: 'collapsed' }));
    },

    /** Handle slash commands */
    handleCommand(input: string) {
      const cmd = input.slice(1).split(' ')[0].toLowerCase();
      const job = get(jobStore);

      switch (cmd) {
        case 'improve': {
          const topic = job.topic || get(studioStore).createTopic;
          update(s => ({
            ...s,
            expansion: 'expanded',
            launcherTopic: topic,
            intent: 'improve',
          }));
          break;
        }
        case 'retry': {
          const topic = job.topic || get(studioStore).createTopic;
          update(s => ({
            ...s,
            expansion: 'expanded',
            launcherTopic: topic,
            intent: 'retry',
          }));
          break;
        }
        case 'stop': {
          if (job.phase === 'running') {
            jobStore.stopJob();
            studioStore.reset();
            toastStore.warning('Research stopped');
          }
          break;
        }
        case 'status': {
          // Navigate to running research or show toast
          if (job.phase === 'running') {
            router.navigate('studio');
          } else {
            toastStore.info('No research currently in progress');
          }
          break;
        }
        case 'deploy': {
          if (job.phase === 'complete' || get(studioStore).phase === 'complete') {
            studioStore.goToPublish();
            router.navigate('studio');
          }
          break;
        }
        default:
          toastStore.info(`Unknown command: /${cmd}. Type /help for available commands.`);
      }
    },

    /** Reset to initial state */
    reset() {
      set({ ...initialState });
    },
  };
}

export const dockStore = createDockStore();

// ── Derived Stores ──

/** Current dock context phase — derived from jobStore */
export const dockContext = derived<typeof jobStore, DockContextPhase>(
  jobStore,
  ($job) => {
    if ($job.phase === 'running' || $job.phase === 'setup') return 'running';
    if ($job.phase === 'complete') return 'complete';
    return 'idle';
  }
);

/** Dock expansion state */
export const dockExpansion = derived(dockStore, $s => $s.expansion);

/** Launcher topic */
export const dockTopic = derived(dockStore, $s => $s.launcherTopic);

/** Selected preset */
export const dockPresetId = derived(dockStore, $s => $s.selectedPresetId);

/** Launcher intent */
export const dockIntent = derived(dockStore, $s => $s.intent);
