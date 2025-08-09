import { z } from 'zod';
import { DESCRIPTIONS } from './constants.js';

// Configuration for domain-specific detection settings
export const SentinelConfigSchema = z.object({
  progress_indicators: z.array(z.string()).default([]).describe(DESCRIPTIONS.PROGRESS_INDICATORS),
  min_actions_for_detection: z.number().default(5).describe(DESCRIPTIONS.MIN_ACTIONS_FOR_DETECTION),
  alternating_threshold: z.number().default(0.5).describe(DESCRIPTIONS.ALTERNATING_THRESHOLD),
  repetition_threshold: z.number().default(0.4).describe(DESCRIPTIONS.REPETITION_THRESHOLD),
  progress_threshold_adjustment: z
    .number()
    .default(0.2)
    .describe(DESCRIPTIONS.PROGRESS_THRESHOLD_ADJUSTMENT),
  statistical_analysis: z
    .object({
      entropy_threshold: z.number().default(0.6).describe(DESCRIPTIONS.ENTROPY_THRESHOLD),
      variance_threshold: z.number().default(0.1).describe(DESCRIPTIONS.VARIANCE_THRESHOLD),
      trend_threshold: z.number().default(0.1).describe(DESCRIPTIONS.TREND_THRESHOLD),
      cyclicity_threshold: z.number().default(0.3).describe(DESCRIPTIONS.CYCLICITY_THRESHOLD),
    })
    .optional(),
  // Domain-specific semantic configuration
  semantic_intents: z
    .array(z.string())
    .default([
      'performing action',
      'checking status',
      'retrieving information',
      'processing data',
      'handling error',
      'completing task',
      'initiating process',
      'validating result',
      'organizing information',
      'communicating result',
    ])
    .describe(DESCRIPTIONS.SEMANTIC_INTENTS),
});

// Simplified Core Types for LLM usability
export const AgentActionSchema = z.object({
  type: z.string().describe(DESCRIPTIONS.ACTION_NAME),
  timestamp: z
    .number()
    .optional()
    .default(() => Date.now()),
  result: z.string().optional().describe(DESCRIPTIONS.ACTION_RESULT),
});

export const EnvironmentStateSchema = z.object({
  context: z.string().optional().describe(DESCRIPTIONS.ENVIRONMENT_CONTEXT),
  timestamp: z
    .number()
    .optional()
    .default(() => Date.now()),
});

export const CognitiveTraceSchema = z.object({
  last_action: z.string().describe(DESCRIPTIONS.LAST_ACTION),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
});

// Loop Detection Types
export const LoopTypeSchema = z.enum([
  'action_repetition',
  'state_invariance',
  'progress_stagnation',
]);

export const LoopDetectionDetailsSchema = z.object({
  dominant_method: z.string().optional(),
  anomaly_score: z.number().optional(),
  actions_involved_count: z.number().optional(),
  recent_actions_count: z.number().optional(),
  metrics: z.record(z.string(), z.any()).optional(),
});

export const LoopDetectionResultSchema = z.object({
  detected: z.boolean(),
  type: z.optional(LoopTypeSchema),
  confidence: z.number(),
  details: LoopDetectionDetailsSchema,
  actions_involved: z.array(z.string()).optional(),
  statistical_metrics: z
    .object({
      entropy_score: z.number().optional(),
      variance_score: z.number().optional(),
      trend_score: z.number().optional(),
      cyclicity_score: z.number().optional(),
    })
    .optional(),
});

// Enhanced Case-Based Reasoning Types
export const CaseSchema = z.object({
  id: z
    .string()
    .optional()
    .default(() => Math.random().toString(36)),
  problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
  solution: z.string().describe(DESCRIPTIONS.SOLUTION),
  outcome: z.boolean().describe(DESCRIPTIONS.OUTCOME),
  timestamp: z
    .number()
    .optional()
    .default(() => Date.now()),
  // Enhanced metadata for better retrieval
  context: z.string().optional(),
  difficulty_level: z.enum(['low', 'medium', 'high']).optional(),
  success_rate: z.number().min(0).max(1).optional(),
  usage_count: z.number().min(0).default(0),
  // Quality metrics
  confidence_score: z.number().min(0).max(1).optional(),
  validation_score: z.number().min(0).max(1).optional(),
  // Semantic features
  semantic_features: z
    .object({
      intents: z.array(z.string()).optional(),
      sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
  // Similarity metrics (computed during retrieval)
  similarity_metrics: z
    .object({
      semantic_similarity: z.number().optional(),
      jaccard_similarity: z.number().optional(),
      cosine_similarity: z.number().optional(),
      combined_similarity: z.number().optional(),
    })
    .optional(),
});

// MCP Tool Input/Output Types - Flattened for single-level parameters
export const MonitorCognitiveTraceInputSchema = z.object({
  last_action: z.string().describe(DESCRIPTIONS.LAST_ACTION),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
  window_size: z.number().default(10),
});

export const DetectLoopInputSchema = z.object({
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
  detection_method: z.enum(['statistical', 'pattern', 'hybrid']).default('hybrid'),
});

export const StoreExperienceInputSchema = z.object({
  problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
  solution: z.string().describe(DESCRIPTIONS.SOLUTION),
  outcome: z.boolean().describe(DESCRIPTIONS.OUTCOME),
  context: z.string().optional().describe('The context in which this case occurred'),
  difficulty_level: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe('The difficulty level of this case'),
});

export const RetrieveSimilarCasesInputSchema = z.object({
  problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
  max_results: z.number().default(5).describe(DESCRIPTIONS.MAX_RESULTS),
  context_filter: z.string().optional().describe('Filter cases by context'),
  difficulty_filter: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe('Filter cases by difficulty level'),
  outcome_filter: z.boolean().optional().describe('Filter cases by outcome (success/failure)'),
  min_similarity: z.number().min(0).max(1).default(0.1).describe('Minimum similarity threshold'),
});

// Type exports
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;
export type CognitiveTrace = z.infer<typeof CognitiveTraceSchema>;
export type LoopType = z.infer<typeof LoopTypeSchema>;
export type LoopDetectionResult = z.infer<typeof LoopDetectionResultSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type SentinelConfig = z.infer<typeof SentinelConfigSchema>;
