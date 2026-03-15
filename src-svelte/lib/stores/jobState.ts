import { writable } from 'svelte/store';

import type { AutoresearchJob } from './jobTypes.ts';
import { createEmptyJob } from './jobTypes.ts';

export const jobState = writable<AutoresearchJob>(createEmptyJob());
