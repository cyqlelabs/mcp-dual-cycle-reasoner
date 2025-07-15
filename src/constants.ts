export const DESCRIPTIONS = {
  // Common field descriptions
  LAST_ACTION: 'Latest action name to be added to the accumulated action history',
  RECENT_ACTIONS: 'List of recent action names',
  CURRENT_CONTEXT: 'Current environment context or state',
  GOAL: 'Current goal being pursued',

  // Loop detection
  LOOP_DETECTED: 'Whether a loop was detected',
  LOOP_TYPE: 'Type of loop detected',
  LOOP_CONFIDENCE: 'Confidence in loop detection',
  LOOP_DETAILS: 'Details about the detected loop',
  ACTIONS_INVOLVED: 'Actions involved in the loop',
  DETECTION_METHOD: 'Loop detection method to use',

  // Statistical metrics
  ENTROPY_SCORE: 'Statistical entropy score',
  VARIANCE_SCORE: 'Statistical variance score',
  TREND_SCORE: 'Statistical trend score',
  CYCLICITY_SCORE: 'Statistical cyclicity score',

  // Diagnosis
  PRIMARY_HYPOTHESIS: 'Primary hypothesis from diagnosis',
  DIAGNOSIS_CONFIDENCE: 'Confidence in diagnosis',
  EVIDENCE: 'Evidence supporting the diagnosis',
  SUGGESTED_ACTIONS: 'Suggested actions from diagnosis',
  SENTIMENT_SCORE: 'Semantic sentiment score',
  CONFIDENCE_FACTORS: 'Factors affecting confidence',
  EVIDENCE_QUALITY: 'Quality of evidence',

  // Recovery
  AVAILABLE_PATTERNS: 'Available recovery patterns',

  // Beliefs
  CURRENT_BELIEFS: 'Current beliefs as simple strings',
  CONTRADICTING_EVIDENCE: 'Evidence that contradicts current beliefs',
  INITIAL_BELIEFS: 'Initial beliefs about the task and environment',
  REVISED_BELIEFS: 'Updated beliefs as simple strings',
  REMOVED_BELIEFS: 'Beliefs that were removed',
  RATIONALE: 'Explanation for the changes',

  // Experience/Cases
  PROBLEM_DESCRIPTION: 'Simple description of the problem',
  SOLUTION: 'What action resolved the issue',
  OUTCOME: 'Whether the solution was successful',

  // Configuration
  WINDOW_SIZE: 'Size of the monitoring window',
  MAX_RESULTS: 'Maximum number of cases to return',

  // Recovery outcome
  SUCCESSFUL: 'Whether the recovery was successful',
  EXPLANATION: 'Explanation of the outcome',

  // Configuration parameters
  PROGRESS_INDICATORS:
    'Action patterns that indicate positive task progress (e.g., ["success", "complete", "found"])',
  MIN_ACTIONS_FOR_DETECTION: 'Minimum number of actions required before loop detection',
  ALTERNATING_THRESHOLD: 'Threshold for detecting alternating action patterns (0.0-1.0)',
  REPETITION_THRESHOLD: 'Threshold for detecting repetitive action patterns (0.0-1.0)',
  PROGRESS_THRESHOLD_ADJUSTMENT:
    'How much to increase thresholds when progress indicators are present',

  // Threshold descriptions
  ENTROPY_THRESHOLD: 'Threshold for entropy-based anomaly detection',
  VARIANCE_THRESHOLD: 'Threshold for variance-based stagnation detectio cfn',
  TREND_THRESHOLD: 'Threshold for trend-based progress detection',
  CYCLICITY_THRESHOLD: 'Threshold for detecting cyclical patterns',

  // Action and state descriptions
  ACTION_NAME: "Action name (e.g., 'scroll_down', 'click_element')",
  ACTION_RESULT: 'Result or error from the action',
  ENVIRONMENT_CONTEXT: 'Current environment context or location',
} as const;
