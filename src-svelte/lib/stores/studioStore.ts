import { writable, derived, get } from 'svelte/store';
import { jobStore } from './jobStore.ts';
import type { ResearchTypeId } from '../data/researchTypes.ts';

// ── Types ──

export type StudioPhase = 'idle' | 'step1' | 'step1-topic' | 'step2' | 'setup' | 'running' | 'complete' | 'publish' | 'published';

export type ResourceMode = 'demo' | 'local' | 'network' | 'hybrid';

interface StudioState {
  phase: StudioPhase;
  /** Topic entered in CREATE phase */
  createTopic: string;
  /** Preset ID if user selected one */
  createPreset: string | null;
  /** Selected research type (llm, expert, classifier, etc.) */
  researchType: ResearchTypeId | null;
  /** Type-specific option selected in step2 */
  step2Selection: string | null;
  /** Resource execution mode */
  resourceMode: ResourceMode;
  /** If forking from existing research */
  forkSource: string | null;
  /** If user navigated away and came back, remember last phase */
  lastActivePhase: StudioPhase | null;
  /** Model ID after successful publish */
  publishedModelId: string | null;
}

// ── Initial State ──

const initialState: StudioState = {
  phase: 'idle',
  createTopic: '',
  createPreset: null,
  researchType: null,
  step2Selection: null,
  resourceMode: 'demo',
  forkSource: null,
  lastActivePhase: null,
  publishedModelId: null,
};

// ── Store ──

function createStudioStore() {
  const { subscribe, set, update } = writable<StudioState>(initialState);

  return {
    subscribe,

    /** Set phase directly */
    setPhase(phase: StudioPhase) {
      update(s => ({ ...s, phase, lastActivePhase: s.phase }));
    },

    /** Set topic for CREATE phase */
    setTopic(topic: string) {
      update(s => ({ ...s, createTopic: topic }));
    },

    /** Apply a preset in CREATE phase */
    setPreset(presetId: string) {
      update(s => ({ ...s, createPreset: presetId }));
    },

    /** Set research type */
    setResearchType(type: ResearchTypeId) {
      update(s => ({ ...s, researchType: type }));
    },

    /** Set step2 type-specific selection */
    setStep2Selection(selection: string) {
      update(s => ({ ...s, step2Selection: selection }));
    },

    /** Set resource execution mode */
    setResourceMode(mode: ResourceMode) {
      update(s => ({ ...s, resourceMode: mode }));
    },

    /** Set fork source */
    setForkSource(source: string | null) {
      update(s => ({ ...s, forkSource: source }));
    },

    /** Transition: IDLE → STEP1 (preset type selection) */
    startCreate(topic?: string) {
      update(s => ({
        ...s,
        phase: 'step1',
        createTopic: topic ?? '',
        createPreset: null,
        researchType: null,
        step2Selection: null,
        forkSource: null,
        lastActivePhase: s.phase,
      }));
    },

    /** Transition: STEP1 → STEP1-TOPIC (type-specific topic input) */
    goToTopicInput(type: ResearchTypeId) {
      update(s => ({
        ...s,
        phase: 'step1-topic',
        researchType: type,
        lastActivePhase: s.phase,
      }));
    },

    /** Transition: STEP1-TOPIC → STEP2 (type-specific options) */
    goToStep2(topic?: string) {
      update(s => ({
        ...s,
        phase: 'step2',
        createTopic: topic ?? s.createTopic,
        lastActivePhase: s.phase,
      }));
    },

    /** Transition: STEP2 → SETUP (advanced config) */
    goToSetup() {
      update(s => ({ ...s, phase: 'setup', lastActivePhase: s.phase }));
    },

    /** Transition: STEP2/SETUP → RUNNING */
    startRunning() {
      update(s => ({ ...s, phase: 'running', lastActivePhase: s.phase }));
    },

    /** Launch from dock terminal — bypasses STEP1/STEP2 entirely */
    launchFromDock(topic: string, presetId?: string) {
      update(s => ({
        ...s,
        phase: 'running',
        createTopic: topic,
        createPreset: presetId ?? null,
        lastActivePhase: 'idle',
      }));
    },

    /** Transition: RUNNING → COMPLETE */
    completeResearch() {
      update(s => ({ ...s, phase: 'complete', lastActivePhase: s.phase }));
    },

    /** Transition: COMPLETE → PUBLISH */
    goToPublish() {
      update(s => ({ ...s, phase: 'publish', lastActivePhase: s.phase }));
    },

    /** Transition: PUBLISH → PUBLISHED (model minted) */
    confirmPublished(modelId: string) {
      update(s => ({ ...s, phase: 'published', publishedModelId: modelId, lastActivePhase: s.phase }));
    },

    /** Reset to IDLE (from any state) */
    reset() {
      set({ ...initialState });
    },

    /** Go back one step */
    goBack() {
      update(s => {
        switch (s.phase) {
          case 'step1':
            return { ...s, phase: 'idle' as StudioPhase, lastActivePhase: s.phase };
          case 'step1-topic':
            return { ...s, phase: 'step1' as StudioPhase, lastActivePhase: s.phase };
          case 'step2':
            return { ...s, phase: 'step1-topic' as StudioPhase, lastActivePhase: s.phase };
          case 'setup':
            return { ...s, phase: 'step2' as StudioPhase, lastActivePhase: s.phase };
          case 'running':
            // Can't go back from running — must stop first
            return s;
          case 'complete':
            return { ...s, phase: 'idle' as StudioPhase, lastActivePhase: s.phase };
          case 'publish':
            return { ...s, phase: 'complete' as StudioPhase, lastActivePhase: s.phase };
          case 'published':
            return { ...s, phase: 'idle' as StudioPhase, lastActivePhase: s.phase };
          default:
            return s;
        }
      });
    },

    /**
     * Auto-detect phase from jobStore on page entry.
     * If a job is running, show RUNNING. If complete, show COMPLETE.
     */
    syncFromJobStore() {
      const job = get(jobStore);
      update(s => {
        if (job.phase === 'running' || job.phase === 'setup') {
          return { ...s, phase: 'running', createTopic: job.topic || s.createTopic };
        }
        if (job.phase === 'complete') {
          return { ...s, phase: 'complete', createTopic: job.topic || s.createTopic };
        }
        return s;
      });
    },
  };
}

export const studioStore = createStudioStore();

// ── Derived Stores ──

export const studioPhase = derived(studioStore, $s => $s.phase);
export const studioTopic = derived(studioStore, $s => $s.createTopic);
export const studioResourceMode = derived(studioStore, $s => $s.resourceMode);
export const studioResearchType = derived(studioStore, $s => $s.researchType);
