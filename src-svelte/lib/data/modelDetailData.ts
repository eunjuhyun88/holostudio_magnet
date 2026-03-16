/** Static data for ModelDetailPage — benchmark data and demo model */

export const DEMO_MODEL = {
  id: "model-um69vho1",
  name: "Crypto Market 24h Prediction",
  slug: "hoot/crypto-market-24h",
  type: "Transformer",
  framework: "PyTorch",
  topic: "Ethereum price prediction",
  metric: "val_bpb",
  metricValue: 1.231,
  totalExperiments: 147,
  kept: 48,
  discarded: 96,
  crashed: 3,
  duration: "4h 32m",
  date: "2026-03-12",
  updated: "2 days ago",
  features: 18,
  rows: 479,
  downloads: 1243,
  likes: 38,
  tags: ["crypto", "price-prediction", "transformer", "ethereum", "time-series"],
  license: "Apache 2.0",
  branches: 6,
};

export const EXPERIMENT_LOG = [
  { id: 147, status: 'keep', mod: 'added cosine lr schedule', metric: 1.231, delta: -0.003 },
  { id: 146, status: 'discard', mod: 'sequence length 256 → 512', metric: 1.289, delta: 0.055 },
  { id: 145, status: 'keep', mod: 'embedding dim 128 → 256', metric: 1.234, delta: -0.008 },
  { id: 144, status: 'discard', mod: 'removed dropout, added mixup', metric: 1.267, delta: 0.025 },
  { id: 143, status: 'keep', mod: 'added skip connection', metric: 1.242, delta: -0.004 },
  { id: 142, status: 'crash', mod: 'doubled context window', metric: 0, delta: 0 },
  { id: 141, status: 'discard', mod: 'switched to AdamW', metric: 1.258, delta: 0.012 },
  { id: 140, status: 'keep', mod: 'added gradient clipping 1.0', metric: 1.246, delta: -0.002 },
  { id: 139, status: 'discard', mod: 'lr: 3e-4 → 1e-4', metric: 1.271, delta: 0.023 },
  { id: 138, status: 'keep', mod: 'reduced lr to 3e-5', metric: 1.248, delta: -0.006 },
];

export const BENCHMARK_DATA = {
  baseline: { name: 'Pipeline (Rule-based)', balAcc: 0.9499, fp: 17, fn: 11 },
  best: { name: 'ExtraTrees Decision Head', balAcc: 0.9719, fp: 12, fn: 5 },
  safest: { name: 'RF Decision Head (L2)', balAcc: 0.9712, fp: 21, fn: 1 },
  models: [
    { name: 'Pipeline (Baseline)', balAcc: 0.9499, fp: 17, fn: 11, params: '—', time: '—', isBest: false, isBaseline: true },
    { name: 'SML-Former++', balAcc: 0.9287, fp: 38, fn: 9, params: '939K', time: '~55s/fold', isBest: false, isBaseline: false },
    { name: 'MLP Decision Head', balAcc: 0.9196, fp: null, fn: null, params: '~10K', time: '~5s/fold', isBest: false, isBaseline: false },
    { name: 'RF Decision Head', balAcc: 0.9688, fp: 23, fn: 1, params: '~200K', time: '<1s/fold', isBest: false, isBaseline: false },
    { name: 'ExtraTrees (Best)', balAcc: 0.9719, fp: 12, fn: 5, params: '~300K', time: '<1s/fold', isBest: true, isBaseline: false },
    { name: 'RF (Safest, L2)', balAcc: 0.9712, fp: 21, fn: 1, params: '~200K', time: '<1s/fold', isBest: false, isBaseline: false },
  ],
  featureImportance: [
    { name: 'pipe_unsafe_low_clip', value: 0.108 },
    { name: 'pipe_safe_high_violence', value: 0.093 },
    { name: 'pipeline_pred_label', value: 0.082 },
    { name: 'ucf_violence_p99', value: 0.056 },
    { name: 'ucf_violence_p5', value: 0.049 },
    { name: 'safety_head_score', value: 0.044 },
    { name: 'clip_sim_mean', value: 0.038 },
    { name: 'context_clf_prob', value: 0.035 },
    { name: 'ucf_violence_mean', value: 0.031 },
    { name: 'frame_entropy_std', value: 0.027 },
  ],
  contextPerformance: [
    { context: 'adult_content', n: 89, pipeAcc: 0.966, dhAcc: 0.978, pipeFp: 2, pipeFn: 1, dhFp: 1, dhFn: 1 },
    { context: 'violence', n: 134, pipeAcc: 0.940, dhAcc: 0.970, pipeFp: 5, pipeFn: 3, dhFp: 3, dhFn: 1 },
    { context: 'hate_speech', n: 67, pipeAcc: 0.955, dhAcc: 0.970, pipeFp: 2, pipeFn: 1, dhFp: 1, dhFn: 1 },
    { context: 'self_harm', n: 45, pipeAcc: 0.933, dhAcc: 0.956, pipeFp: 1, pipeFn: 2, dhFp: 1, dhFn: 1 },
    { context: 'law_enforcement', n: 86, pipeAcc: 0.814, dhAcc: 0.849, pipeFp: 4, pipeFn: 7, dhFp: 5, dhFn: 0 },
    { context: 'medical_procedure', n: 52, pipeAcc: 0.942, dhAcc: 0.962, pipeFp: 2, pipeFn: 1, dhFp: 1, dhFn: 1 },
    { context: 'news_documentary', n: 78, pipeAcc: 0.962, dhAcc: 0.974, pipeFp: 1, pipeFn: 2, dhFp: 1, dhFn: 1 },
  ],
  timeline: [
    { date: '3/9 AM', label: 'SML-Former++ Training', detail: 'bal_acc 0.9287', type: 'fail' },
    { date: '3/9 PM', label: 'Pivot → Decision Head', detail: 'bal_acc 0.9647', type: 'pivot' },
    { date: '3/9 Night', label: 'Feature Engineering', detail: '130 → 55 features', type: 'progress' },
    { date: '3/10 AM', label: 'ExtraTrees Achieved', detail: 'bal_acc 0.9719', type: 'success' },
  ],
};

export const SPARK_DATA = [12, 18, 15, 22, 28, 31, 25, 34, 42, 38, 45, 52, 48, 55, 61, 58, 65, 72, 68, 78, 82, 75, 88, 95, 91, 98, 105, 112, 108, 120];
