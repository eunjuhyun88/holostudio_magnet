import type { ModCategory } from '../data/modifications.ts';

/* ─── User Experiment (user intervention) ─── */

export interface UserExperiment {
  id: string;
  type: 'prompt' | 'fork' | 'strategy-edit';
  description: string;
  parentExperimentId?: number;
  targetBranch?: ModCategory;
  status: 'queued' | 'training' | 'completed' | 'failed';
  metric?: number;
  submittedAt: number;
}
