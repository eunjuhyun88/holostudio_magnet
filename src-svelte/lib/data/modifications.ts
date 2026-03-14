/** Experiment modification strings used by the job simulator */
export const MODIFICATIONS = [
  'lr: 3e-4 → 1e-4',
  'added dropout 0.1',
  'batch_size: 64 → 128',
  'added layer norm',
  'widened hidden dim 256 → 512',
  'added residual connection',
  'lr: 1e-4 → 5e-5, warmup 100',
  'replaced ReLU with GELU',
  'added weight decay 0.01',
  'increased depth 4 → 6 layers',
  'added attention head',
  'reduced lr to 3e-5',
  'added gradient clipping 1.0',
  'doubled context window',
  'switched to AdamW',
  'added cosine lr schedule',
  'embedding dim 128 → 256',
  'added skip connection',
  'removed dropout, added mixup',
  'sequence length 256 → 512',
];

/** Human-readable translations of experiment modifications */
export const HUMAN_READABLE: Record<string, string> = {
  'lr: 3e-4 → 1e-4': 'Slowing down learning speed for better precision',
  'added dropout 0.1': 'Adding noise resilience to prevent overfitting',
  'batch_size: 64 → 128': 'Processing more data at once for stability',
  'added layer norm': 'Normalizing layer outputs for smoother training',
  'widened hidden dim 256 → 512': 'Expanding model capacity to capture more patterns',
  'added residual connection': 'Adding shortcut paths for better gradient flow',
  'lr: 1e-4 → 5e-5, warmup 100': 'Fine-tuning with gradual learning warmup',
  'replaced ReLU with GELU': 'Switching to smoother activation for better learning',
  'added weight decay 0.01': 'Adding regularization to prevent memorization',
  'increased depth 4 → 6 layers': 'Making the model deeper for complex patterns',
  'added attention head': 'Adding attention mechanism to focus on key signals',
  'reduced lr to 3e-5': 'Reducing learning speed for final refinement',
  'added gradient clipping 1.0': 'Preventing training instability from large updates',
  'doubled context window': 'Looking at more historical data for predictions',
  'switched to AdamW': 'Using advanced optimizer with better convergence',
  'added cosine lr schedule': 'Gradually reducing learning rate like a cooling process',
  'embedding dim 128 → 256': 'Enriching data representation for nuanced features',
  'added skip connection': 'Adding information highway for faster learning',
  'removed dropout, added mixup': 'Switching regularization strategy for better generalization',
  'sequence length 256 → 512': 'Extending analysis window for longer-range patterns',
  'baseline model (initial run)': 'Starting with baseline configuration',
};

/* ─── Visualization Category Mapping ─── */

/** Modification category types for charts */
export type ModCategory =
  | 'learning_rate'
  | 'batch_size'
  | 'architecture'
  | 'regularization'
  | 'optimizer'
  | 'context'
  | 'activation'
  | 'embedding'
  | 'baseline';

/** Map each modification string to a category */
export const MOD_CATEGORY: Record<string, ModCategory> = {
  'lr: 3e-4 → 1e-4': 'learning_rate',
  'lr: 1e-4 → 5e-5, warmup 100': 'learning_rate',
  'reduced lr to 3e-5': 'learning_rate',
  'added cosine lr schedule': 'learning_rate',
  'batch_size: 64 → 128': 'batch_size',
  'added layer norm': 'architecture',
  'widened hidden dim 256 → 512': 'architecture',
  'added residual connection': 'architecture',
  'added skip connection': 'architecture',
  'increased depth 4 → 6 layers': 'architecture',
  'added attention head': 'architecture',
  'doubled context window': 'context',
  'sequence length 256 → 512': 'context',
  'added dropout 0.1': 'regularization',
  'added weight decay 0.01': 'regularization',
  'added gradient clipping 1.0': 'regularization',
  'removed dropout, added mixup': 'regularization',
  'replaced ReLU with GELU': 'activation',
  'switched to AdamW': 'optimizer',
  'embedding dim 128 → 256': 'embedding',
  'baseline model (initial run)': 'baseline',
};

/** Human-readable category labels */
export const CATEGORY_LABELS: Record<ModCategory, string> = {
  learning_rate: 'Learning Rate',
  batch_size: 'Batch Size',
  architecture: 'Architecture',
  regularization: 'Regularization',
  optimizer: 'Optimizer',
  context: 'Context/Seq',
  activation: 'Activation',
  embedding: 'Embedding',
  baseline: 'Baseline',
};

/** Short category labels for compact charts */
export const CATEGORY_SHORT: Record<ModCategory, string> = {
  learning_rate: 'LR',
  batch_size: 'Batch',
  architecture: 'Arch',
  regularization: 'Reg',
  optimizer: 'Opt',
  context: 'Ctx',
  activation: 'Act',
  embedding: 'Emb',
  baseline: 'Base',
};

/** Category colors for charts */
export const CATEGORY_COLORS: Record<ModCategory, string> = {
  learning_rate: '#D97757',
  batch_size: '#2d6ca2',
  architecture: '#27864a',
  regularization: '#b7860e',
  optimizer: '#8b5cf6',
  context: '#0891b2',
  activation: '#e11d48',
  embedding: '#059669',
  baseline: '#9a9590',
};

/** Branch strategy descriptions — shown in "AI doing what?" panel */
export const BRANCH_STRATEGIES: Record<ModCategory, string> = {
  learning_rate: 'Sweep cosine-annealing, warm-restart and 1-cycle schedules; probe 3e-4 → 3e-5 log-range with warmup ablations',
  batch_size: 'Test micro-batch 32–256 with gradient accumulation; compare throughput vs. convergence trade-off',
  architecture: 'Mutate transformer blocks — attention heads, FFN width, residual paths, skip connections, layer depth ±2',
  regularization: 'Compare dropout, weight decay, gradient clipping, label smoothing and mixup; ablate pairs',
  optimizer: 'Benchmark AdamW vs Lion vs Sophia; tune β1/β2, momentum and decoupled weight decay',
  context: 'Extend context window 256 → 512 → 1024; test RoPE vs ALiBi positional encodings',
  activation: 'Swap GELU / SiLU / Mish activations; measure gradient flow and downstream metric impact',
  embedding: 'Scale embedding dim 128 → 256 → 512; evaluate learned vs. fixed positional embeddings',
  baseline: 'Establish baseline with default config; measure cold-start val_bpb for reference',
};

/** AI agent reasoning thoughts shown during research */
export const AI_THOUGHTS = [
  'Analyzing loss convergence patterns across branches...',
  'Evaluating hyperparameter sensitivity for learning rate...',
  'Cross-referencing architecture variations with metric deltas...',
  'Pruning underperforming configuration subspace...',
  'Generating next-round experiment candidates...',
  'Comparing gradient flow statistics across layers...',
  'Optimizing batch scheduling for GPU utilization...',
  'Correlating dropout rates with validation improvements...',
  'Adjusting search distribution based on promising regions...',
  'Running statistical significance tests on top results...',
];

/** Resolve a category for both simulator-native mods and runtime result descriptions */
export function resolveExperimentCategory(modification: string): ModCategory {
  const exact = MOD_CATEGORY[modification];
  if (exact) {
    return exact;
  }

  const normalized = modification.toLowerCase();

  if (/adam|adamw|muon|optimizer|momentum|beta1|beta2|betas/.test(normalized)) {
    return 'optimizer';
  }
  if (/lr|learning rate|warmup|warmdown|schedule|decay floor|final lr|cosine decay/.test(normalized)) {
    return 'learning_rate';
  }
  if (/batch|device batch|total batch|micro.?batch/.test(normalized)) {
    return 'batch_size';
  }
  if (/dropout|weight decay|gradient clipping|regularization|mixup|label smoothing/.test(normalized)) {
    return 'regularization';
  }
  if (/gelu|relu|silu|mish|activation/.test(normalized)) {
    return 'activation';
  }
  if (/embedding|unembedding|vocab/.test(normalized)) {
    return 'embedding';
  }
  if (/context|seq|sequence|window|rope|rotary|theta|alibi|span/.test(normalized)) {
    return 'context';
  }
  if (/attention|head|residual|projection|layer|depth|width|norm|gate|mlp|softcap|architecture|init|qk/.test(normalized)) {
    return 'architecture';
  }

  return 'baseline';
}
