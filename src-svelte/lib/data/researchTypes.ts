/**
 * researchTypes.ts — Research type presets for Magnet Studio
 *
 * Five research types from MAGNET v2, each with:
 *   - Metadata (name, level, time, tags)
 *   - PixelIcon type for consistent icon tone
 *   - Step 1 question and examples
 *   - Step 2 options (type-specific selections)
 */

export type ResearchTypeId = 'llm' | 'expert' | 'distillation' | 'classifier' | 'finetune';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type PixelIconType = 'sparkle' | 'grid' | 'chart' | 'globe' | 'protocol' | 'arrow' | 'research' | 'portfolio' | 'ontology';

export interface Step2Option {
  id: string;
  label: string;
  desc: string;
  pixelIcon?: PixelIconType;
}

export interface ResearchType {
  id: ResearchTypeId;
  name: string;
  desc: string;
  level: DifficultyLevel;
  time: string;
  tags: string[];
  pixelIcon: PixelIconType;
  accentColor: string;
  /** Step 1 — type-specific question */
  step1Question: string;
  step1Placeholder: string;
  step1Examples: { label: string; topic: string }[];
  /** Step 2 — type-specific option group */
  step2Label: string;
  step2Options: Step2Option[];
}

export const RESEARCH_TYPES: ResearchType[] = [
  {
    id: 'llm',
    name: 'Build LLM',
    desc: 'Train a language model from scratch using BitNet architecture',
    level: 'advanced',
    time: '~6h+',
    tags: ['BitNet', 'From Scratch'],
    pixelIcon: 'sparkle',
    accentColor: '#8B5CF6',
    step1Question: 'What kind of LLM will you build?',
    step1Placeholder: 'e.g. Korean legal Q&A assistant',
    step1Examples: [
      { label: 'Legal Q&A', topic: 'Korean Legal Q&A Assistant' },
      { label: 'Code Generator', topic: 'Code Generation LLM' },
      { label: 'Medical Chat', topic: 'Medical Consultation Chatbot' },
    ],
    step2Label: 'Model Size',
    step2Options: [
      { id: '300m', label: '300M params', desc: 'Fast training, good for prototyping', pixelIcon: 'arrow' },
      { id: '1b', label: '1B params', desc: 'Balanced performance and cost', pixelIcon: 'chart' },
      { id: '3b', label: '3B params', desc: 'Best quality, requires more compute', pixelIcon: 'sparkle' },
    ],
  },
  {
    id: 'expert',
    name: 'Add Expert',
    desc: 'Attach a decision head to an existing LLM for specialized tasks',
    level: 'intermediate',
    time: '~2h',
    tags: ['Hybrid', 'Classification'],
    pixelIcon: 'chart',
    accentColor: '#D97757',
    step1Question: 'What judgment would you like to automate?',
    step1Placeholder: 'e.g. Content moderation classifier',
    step1Examples: [
      { label: 'Content Moderation', topic: 'Content Moderation Classifier' },
      { label: 'Sentiment Analysis', topic: 'Sentiment Analysis Expert' },
      { label: 'Intent Detection', topic: 'User Intent Detection' },
    ],
    step2Label: 'Base LLM',
    step2Options: [
      { id: 'qwen3-8b', label: 'Qwen3-8B', desc: 'High-performance open model', pixelIcon: 'sparkle' },
      { id: 'bitnet-1b', label: 'BitNet 1B', desc: 'Lightweight, efficient inference', pixelIcon: 'arrow' },
      { id: 'custom', label: 'Custom Upload', desc: 'Use your own base model', pixelIcon: 'portfolio' },
    ],
  },
  {
    id: 'distillation',
    name: 'Distillation',
    desc: 'Transfer knowledge from a large model to a smaller, faster one',
    level: 'intermediate',
    time: '~3h',
    tags: ['Distillation', 'Knowledge Transfer'],
    pixelIcon: 'ontology',
    accentColor: '#2980b9',
    step1Question: 'What knowledge would you like to transfer?',
    step1Placeholder: 'e.g. GPT-4 reasoning into a 1B model',
    step1Examples: [
      { label: 'Reasoning Transfer', topic: 'Reasoning Distillation to 1B' },
      { label: 'Code Skills', topic: 'Code Generation Distillation' },
      { label: 'Domain Knowledge', topic: 'Medical Knowledge Transfer' },
    ],
    step2Label: 'Teacher Model',
    step2Options: [
      { id: 'gpt4', label: 'GPT-4 API', desc: 'Highest quality teacher', pixelIcon: 'sparkle' },
      { id: 'claude', label: 'Claude API', desc: 'Balanced reasoning and cost', pixelIcon: 'protocol' },
      { id: 'local', label: 'Local Model', desc: 'Use your own large model', pixelIcon: 'globe' },
    ],
  },
  {
    id: 'classifier',
    name: 'Data Classifier',
    desc: 'Build a classifier for tabular data using AutoML',
    level: 'beginner',
    time: '~30m',
    tags: ['AutoML', 'Tabular'],
    pixelIcon: 'grid',
    accentColor: '#27864a',
    step1Question: 'What data would you like to classify?',
    step1Placeholder: 'e.g. Customer churn prediction',
    step1Examples: [
      { label: 'Churn Prediction', topic: 'Customer Churn Prediction' },
      { label: 'Fraud Detection', topic: 'Transaction Fraud Detection' },
      { label: 'Price Forecast', topic: 'Crypto Price Prediction' },
    ],
    step2Label: 'Data Source',
    step2Options: [
      { id: 'csv', label: 'CSV Upload', desc: 'Upload your dataset file', pixelIcon: 'portfolio' },
      { id: 'api', label: 'API Connect', desc: 'Pull data from an API endpoint', pixelIcon: 'globe' },
      { id: 'demo', label: 'Demo Data', desc: 'Use built-in sample dataset', pixelIcon: 'research' },
    ],
  },
  {
    id: 'finetune',
    name: 'Fine-tune',
    desc: 'Enhance an existing model with LoRA fine-tuning',
    level: 'intermediate',
    time: '~1h',
    tags: ['Fine-tune', 'LoRA'],
    pixelIcon: 'research',
    accentColor: '#d4a017',
    step1Question: 'What capability would you like to enhance?',
    step1Placeholder: 'e.g. Korean language fluency',
    step1Examples: [
      { label: 'Language Fluency', topic: 'Korean Language Fine-tuning' },
      { label: 'Domain Expertise', topic: 'Finance Domain Fine-tune' },
      { label: 'Style Transfer', topic: 'Writing Style Transfer' },
    ],
    step2Label: 'Base Model',
    step2Options: [
      { id: 'magnet-latest', label: 'MAGNET Latest', desc: 'Our latest optimized model', pixelIcon: 'sparkle' },
      { id: 'qwen3-8b', label: 'Qwen3-8B', desc: 'High-performance open model', pixelIcon: 'chart' },
      { id: 'custom', label: 'Custom Upload', desc: 'Use your own base model', pixelIcon: 'portfolio' },
    ],
  },
];

export const LEVEL_LABELS: Record<DifficultyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  beginner: '#27864a',
  intermediate: '#d4a017',
  advanced: '#c0392b',
};

export function getResearchType(id: ResearchTypeId): ResearchType | undefined {
  return RESEARCH_TYPES.find(t => t.id === id);
}
