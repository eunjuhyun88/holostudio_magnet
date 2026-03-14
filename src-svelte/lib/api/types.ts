import type { ModCategory } from '../data/modifications.ts';

/* ─── User Experiment (유저 개입) ─── */

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
