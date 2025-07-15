import { z } from 'zod';

// Configuration for domain-specific detection settings
export const SentinelConfigSchema = z.object({
  progress_indicators: z
    .array(z.string())
    .default([])
    .describe('Action patterns that indicate positive task progress'),
  min_actions_for_detection: z
    .number()
    .default(5)
    .describe('Minimum number of actions required before loop detection'),
  alternating_threshold: z
    .number()
    .default(0.5)
    .describe('Threshold for detecting alternating action patterns'),
  repetition_threshold: z
    .number()
    .default(0.4)
    .describe('Threshold for detecting repetitive action patterns'),
  progress_threshold_adjustment: z
    .number()
    .default(0.2)
    .describe('How much to increase thresholds when progress indicators are present'),
  statistical_analysis: z
    .object({
      entropy_threshold: z
        .number()
        .default(0.6)
        .describe('Threshold for entropy-based anomaly detection'),
      variance_threshold: z
        .number()
        .default(0.1)
        .describe('Threshold for variance-based stagnation detection'),
      trend_threshold: z
        .number()
        .default(0.1)
        .describe('Threshold for trend-based progress detection'),
      cyclicity_threshold: z
        .number()
        .default(0.3)
        .describe('Threshold for detecting cyclical patterns'),
    })
    .optional(),
});

// Simplified Core Types for LLM usability
export const AgentActionSchema = z.object({
  type: z.string().describe("Action name (e.g., 'scroll_down', 'click_element')"),
  timestamp: z
    .number()
    .optional()
    .default(() => Date.now()),
  result: z.string().optional().describe('Result or error from the action'),
});

export const EnvironmentStateSchema = z.object({
  context: z.string().optional().describe('Current environment context or location'),
  timestamp: z
    .number()
    .optional()
    .default(() => Date.now()),
});

export const CognitiveTraceSchema = z.object({
  recent_actions: z.array(z.string()).describe('List of recent action names'),
  current_context: z.string().optional().describe('Current environment context or state'),
  goal: z.string().describe('Current goal being pursued'),
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
  problem_description: z.string().describe('Simple description of the problem'),
  solution: z.string().describe('What action resolved the issue'),
  outcome: z.boolean().describe('Whether the solution was successful'),
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
  revised_beliefs: z.array(z.string()).describe('Updated beliefs as simple strings'),
  removed_beliefs: z.array(z.string()).describe('Beliefs that were removed'),
  rationale: z.string().describe('Explanation for the changes'),
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
  recent_actions: z.array(z.string()).describe('List of recent action names'),
  current_context: z.string().optional().describe('Current environment context or state'),
  goal: z.string().describe('Current goal being pursued'),
  window_size: z.number().default(10),
});

export const DetectLoopInputSchema = z.object({
  recent_actions: z.array(z.string()).describe('Recent actions to check for loops'),
  current_context: z.string().optional().describe('Current environment context or state'),
  goal: z.string().describe('Current goal being pursued'),
  detection_method: z.enum(['statistical', 'pattern', 'hybrid']).default('hybrid'),
});

export const DiagnoseFailureInputSchema = z.object({
  loop_detected: z.boolean().describe('Whether a loop was detected'),
  loop_type: z.optional(LoopTypeSchema).describe('Type of loop detected'),
  loop_confidence: z.number().describe('Confidence in loop detection'),
  loop_details: z.string().describe('Details about the detected loop'),
  actions_involved: z.array(z.string()).optional().describe('Actions involved in the loop'),
  entropy_score: z.number().optional().describe('Statistical entropy score'),
  variance_score: z.number().optional().describe('Statistical variance score'),
  trend_score: z.number().optional().describe('Statistical trend score'),
  cyclicity_score: z.number().optional().describe('Statistical cyclicity score'),
  recent_actions: z.array(z.string()).describe('Recent actions from trace'),
  current_context: z.string().optional().describe('Current environment context or state'),
  goal: z.string().describe('Current goal being pursued'),
});

export const ReviseBelifsInputSchema = z.object({
  current_beliefs: z.array(z.string()).describe('Current beliefs as simple strings'),
  contradicting_evidence: z.string().describe('Evidence that contradicts current beliefs'),
  recent_actions: z.array(z.string()).describe('Recent actions from trace'),
  goal: z.string().describe('Current goal being pursued'),
});

export const GenerateRecoveryPlanInputSchema = z.object({
  primary_hypothesis: FailureHypothesisSchema.describe('Primary hypothesis from diagnosis'),
  diagnosis_confidence: z.number().describe('Confidence in diagnosis'),
  evidence: z.array(z.string()).describe('Evidence supporting the diagnosis'),
  suggested_actions: z.array(z.string()).describe('Suggested actions from diagnosis'),
  sentiment_score: z.number().optional().describe('Semantic sentiment score'),
  confidence_factors: z.array(z.string()).optional().describe('Factors affecting confidence'),
  evidence_quality: z.number().optional().describe('Quality of evidence'),
  recent_actions: z.array(z.string()).describe('Recent actions from trace'),
  current_context: z.string().optional().describe('Current environment context or state'),
  goal: z.string().describe('Current goal being pursued'),
  available_patterns: z
    .array(RecoveryPatternSchema)
    .optional()
    .describe('Available recovery patterns'),
});

export const StoreExperienceInputSchema = z.object({
  problem_description: z.string().describe('Simple description of the problem'),
  solution: z.string().describe('What action resolved the issue'),
  outcome: z.boolean().describe('Whether the solution was successful'),
});

export const RetrieveSimilarCasesInputSchema = z.object({
  problem_description: z.string().describe('Description of current problem'),
  max_results: z.number().default(5),
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
