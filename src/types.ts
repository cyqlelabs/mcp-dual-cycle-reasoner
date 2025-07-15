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
  recent_actions: z.array(z.string()).describe(DESCRIPTIONS.RECENT_ACTIONS),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
});

// Loop Detection Types
export const LoopTypeSchema = z.enum([
  'action_repetition',
  'state_invariance',
  'progress_stagnation',
]);

export const LoopDetectionResultSchema = z.object({
  detected: z.boolean(),
  type: z.optional(LoopTypeSchema),
  confidence: z.number(),
  details: z.string(),
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

// Failure Diagnosis Types
export const FailureHypothesisSchema = z.enum([
  'element_state_error',
  'page_state_error',
  'selector_error',
  'task_model_error',
  'network_error',
  'unknown',
]);

export const DiagnosisResultSchema = z.object({
  primary_hypothesis: FailureHypothesisSchema,
  confidence: z.number(),
  evidence: z.array(z.string()),
  suggested_actions: z.array(z.string()),
  semantic_analysis: z
    .object({
      sentiment_score: z.number().optional(),
      confidence_factors: z.array(z.string()).optional(),
      evidence_quality: z.number().optional(),
    })
    .optional(),
});

// Recovery Strategy Types
export const RecoveryPatternSchema = z.enum([
  'strategic_retreat',
  'context_refresh',
  'modality_switching',
  'information_foraging',
  'human_escalation',
]);

export const RecoveryPlanSchema = z.object({
  pattern: RecoveryPatternSchema,
  actions: z.array(z.string()),
  rationale: z.string(),
  expected_outcome: z.string(),
});

// Simplified Case-Based Reasoning Types
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
  similarity_metrics: z
    .object({
      semantic_similarity: z.number().optional(),
      jaccard_similarity: z.number().optional(),
      cosine_similarity: z.number().optional(),
    })
    .optional(),
});

// Belief Revision Types
export const BeliefRevisionResultSchema = z.object({
  revised_beliefs: z.array(z.string()).describe(DESCRIPTIONS.REVISED_BELIEFS),
  removed_beliefs: z.array(z.string()).describe(DESCRIPTIONS.REMOVED_BELIEFS),
  rationale: z.string().describe(DESCRIPTIONS.RATIONALE),
  semantic_analysis: z
    .object({
      contradiction_score: z.number().optional(),
      sentiment_shift: z.number().optional(),
      confidence_level: z.number().optional(),
    })
    .optional(),
});

// MCP Tool Input/Output Types - Flattened for single-level parameters
export const MonitorCognitiveTraceInputSchema = z.object({
  recent_actions: z.array(z.string()).describe(DESCRIPTIONS.RECENT_ACTIONS),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
  window_size: z.number().default(10),
});

export const DetectLoopInputSchema = z.object({
  recent_actions: z.array(z.string()).describe(DESCRIPTIONS.RECENT_ACTIONS),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
  detection_method: z.enum(['statistical', 'pattern', 'hybrid']).default('hybrid'),
});

export const DiagnoseFailureInputSchema = z.object({
  loop_detected: z.boolean().describe(DESCRIPTIONS.LOOP_DETECTED),
  loop_type: z.optional(LoopTypeSchema).describe(DESCRIPTIONS.LOOP_TYPE),
  loop_confidence: z.number().describe(DESCRIPTIONS.LOOP_CONFIDENCE),
  loop_details: z.string().describe(DESCRIPTIONS.LOOP_DETAILS),
  actions_involved: z.array(z.string()).optional().describe(DESCRIPTIONS.ACTIONS_INVOLVED),
  entropy_score: z.number().optional().describe(DESCRIPTIONS.ENTROPY_SCORE),
  variance_score: z.number().optional().describe(DESCRIPTIONS.VARIANCE_SCORE),
  trend_score: z.number().optional().describe(DESCRIPTIONS.TREND_SCORE),
  cyclicity_score: z.number().optional().describe(DESCRIPTIONS.CYCLICITY_SCORE),
  recent_actions: z.array(z.string()).describe(DESCRIPTIONS.RECENT_ACTIONS),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
});

export const ReviseBelifsInputSchema = z.object({
  current_beliefs: z.array(z.string()).describe(DESCRIPTIONS.CURRENT_BELIEFS),
  contradicting_evidence: z.string().describe(DESCRIPTIONS.CONTRADICTING_EVIDENCE),
  recent_actions: z.array(z.string()).describe(DESCRIPTIONS.RECENT_ACTIONS),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
});

export const GenerateRecoveryPlanInputSchema = z.object({
  primary_hypothesis: FailureHypothesisSchema.describe(DESCRIPTIONS.PRIMARY_HYPOTHESIS),
  diagnosis_confidence: z.number().describe(DESCRIPTIONS.DIAGNOSIS_CONFIDENCE),
  evidence: z.array(z.string()).describe(DESCRIPTIONS.EVIDENCE),
  suggested_actions: z.array(z.string()).describe(DESCRIPTIONS.SUGGESTED_ACTIONS),
  sentiment_score: z.number().optional().describe(DESCRIPTIONS.SENTIMENT_SCORE),
  confidence_factors: z.array(z.string()).optional().describe(DESCRIPTIONS.CONFIDENCE_FACTORS),
  evidence_quality: z.number().optional().describe(DESCRIPTIONS.EVIDENCE_QUALITY),
  recent_actions: z.array(z.string()).describe(DESCRIPTIONS.RECENT_ACTIONS),
  current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
  goal: z.string().describe(DESCRIPTIONS.GOAL),
  available_patterns: z
    .array(RecoveryPatternSchema)
    .optional()
    .describe(DESCRIPTIONS.AVAILABLE_PATTERNS),
});

export const StoreExperienceInputSchema = z.object({
  problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
  solution: z.string().describe(DESCRIPTIONS.SOLUTION),
  outcome: z.boolean().describe(DESCRIPTIONS.OUTCOME),
});

export const RetrieveSimilarCasesInputSchema = z.object({
  problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
  max_results: z.number().default(5).describe(DESCRIPTIONS.MAX_RESULTS),
});

// Type exports
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;
export type CognitiveTrace = z.infer<typeof CognitiveTraceSchema>;
export type LoopType = z.infer<typeof LoopTypeSchema>;
export type LoopDetectionResult = z.infer<typeof LoopDetectionResultSchema>;
export type FailureHypothesis = z.infer<typeof FailureHypothesisSchema>;
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;
export type RecoveryPattern = z.infer<typeof RecoveryPatternSchema>;
export type RecoveryPlan = z.infer<typeof RecoveryPlanSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type BeliefRevisionResult = z.infer<typeof BeliefRevisionResultSchema>;
export type SentinelConfig = z.infer<typeof SentinelConfigSchema>;
