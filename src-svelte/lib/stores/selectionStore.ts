import { writable, derived } from 'svelte/store';
import { jobStore, type Experiment } from './jobStore.ts';

/** Currently selected experiment ID — set from any click source */
export const selectedExperimentId = writable<number | null>(null);

/** Full experiment object for the selected ID */
export const selectedExperiment = derived(
  [selectedExperimentId, jobStore],
  ([$id, $job]) => {
    if ($id === null) return null;
    return $job.experiments.find(e => e.id === $id) ?? null;
  }
);

/** Clear selection */
export function clearSelection() {
  selectedExperimentId.set(null);
}

/** Select an experiment */
export function selectExperiment(id: number) {
  selectedExperimentId.set(id);
}
