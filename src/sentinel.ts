import { CognitiveTrace, LoopDetectionResult, LoopType, SentinelConfig } from './types.js';
import { createHash } from 'crypto';

export class Sentinel {
  private stateHistory: string[] = [];
  private readonly maxHistorySize: number = 20;
  private config: SentinelConfig;

  constructor(config: Partial<SentinelConfig> = {}) {
    this.config = {
      progress_indicators: config.progress_indicators || [],
      min_actions_for_detection: config.min_actions_for_detection || 5,
      alternating_threshold: config.alternating_threshold || 0.5,
      repetition_threshold: config.repetition_threshold || 0.4,
      progress_threshold_adjustment: config.progress_threshold_adjustment || 0.2
    };
  }

  /**
   * Strategy 1: Action Trace Analysis & Anomaly Detection
   * Uses statistical methods to detect anomalous patterns in action sequences
   */
  detectActionAnomalies(trace: CognitiveTrace, windowSize: number = 10): LoopDetectionResult {
    if (!trace.recent_actions || trace.recent_actions.length === 0) {
      return { detected: false, confidence: 0, details: 'No action history available' };
    }
    
    // Use configurable minimum actions threshold to avoid false positives on legitimate exploration
    const minActionsForDetection = Math.max(this.config.min_actions_for_detection, Math.min(windowSize, 8));
    if (trace.recent_actions.length < minActionsForDetection) {
      return { detected: false, confidence: 0, details: `Insufficient action history: ${trace.recent_actions.length}/${minActionsForDetection} required` };
    }

    const recentActions = trace.recent_actions.slice(-windowSize);
    const actionTypes = recentActions;
    
    // Check for exact repetition patterns
    const uniqueActions = new Set(actionTypes);
    const repetitionRatio = 1 - (uniqueActions.size / actionTypes.length);
    
    // Check for oscillating patterns (A-B-A-B)
    let oscillationCount = 0;
    for (let i = 2; i < actionTypes.length; i++) {
      if (actionTypes[i] === actionTypes[i-2] && actionTypes[i] !== actionTypes[i-1]) {
        oscillationCount++;
      }
    }
    const oscillationRatio = oscillationCount / Math.max(1, actionTypes.length - 2);
    
    // Enhanced pattern detection for alternating actions
    let alternatingPairs = 0;
    const actionPairs = new Map<string, number>();
    
    // Detect alternating action patterns (A-B-A-B)
    for (let i = 1; i < actionTypes.length; i++) {
      const pair = `${actionTypes[i-1]}->${actionTypes[i]}`;
      const reversePair = `${actionTypes[i]}->${actionTypes[i-1]}`;
      
      actionPairs.set(pair, (actionPairs.get(pair) || 0) + 1);
      
      if (actionPairs.has(reversePair)) {
        alternatingPairs++;
      }
    }
    const alternatingRatio = alternatingPairs / Math.max(1, actionTypes.length - 1);

    // Check for configurable progress indicators that suggest positive task advancement
    const hasProgressAction = this.config.progress_indicators.length > 0 && 
      actionTypes.some(action => 
        this.config.progress_indicators.some(indicator => 
          action.toLowerCase().includes(indicator.toLowerCase())
        )
      );
    
    // Enhanced loop detection for alternating behavior - use configurable thresholds
    // If we have progress indicators, require stronger evidence of loops
    const alternatingThreshold = hasProgressAction ? 
      this.config.alternating_threshold + this.config.progress_threshold_adjustment : 
      this.config.alternating_threshold;
    const repetitionThreshold = hasProgressAction ? 
      this.config.repetition_threshold + this.config.progress_threshold_adjustment : 
      this.config.repetition_threshold;
    
    if (alternatingRatio > alternatingThreshold && repetitionRatio > repetitionThreshold) {
      return {
        detected: true,
        type: 'action_repetition',
        confidence: 0.9,
        details: `Alternating action loop detected: ${alternatingRatio.toFixed(2)} alternating ratio, ${repetitionRatio.toFixed(2)} repetition ratio`,
        actions_involved: Array.from(uniqueActions)
      };
    }
    
    // Check for progress using step count as a simple metric
    if (trace.step_count && trace.step_count > windowSize) {
      const progressRate = trace.recent_actions.length / trace.step_count;
      
      if (progressRate < 0.2) { // Very low progress rate
        return {
          detected: true,
          type: 'action_repetition',
          confidence: 0.85,
          details: `Low progress rate: ${progressRate.toFixed(3)}`
        };
      }
    }

    // Combine repetition, oscillation, and alternating patterns
    const anomalyScore = Math.max(repetitionRatio, oscillationRatio, alternatingRatio);
    
    // Adjust threshold based on whether we have progress indicators
    const anomalyThreshold = hasProgressAction ? 
      Math.max(0.6, this.config.alternating_threshold + this.config.progress_threshold_adjustment) : 
      Math.max(0.5, this.config.alternating_threshold);
    
    if (anomalyScore > anomalyThreshold) {
      return {
        detected: true,
        type: 'action_repetition',
        confidence: Math.min(0.95, anomalyScore + 0.1), // Conservative confidence boost
        details: `Repetition pattern detected: ${(anomalyScore * 100).toFixed(1)}% similarity. Repetition: ${(repetitionRatio * 100).toFixed(1)}%, Oscillation: ${(oscillationRatio * 100).toFixed(1)}%, Alternating: ${(alternatingRatio * 100).toFixed(1)}%`,
        actions_involved: Array.from(uniqueActions) as string[]
      };
    }

    return { 
      detected: false, 
      confidence: 1 - anomalyScore, 
      details: `Action diversity acceptable: ${(anomalyScore * 100).toFixed(1)}% repetition` 
    };
  }

  /**
   * Strategy 2: State Invariance Tracking
   * Detects when the agent returns to previously visited states
   */
  detectStateInvariance(trace: CognitiveTrace, threshold: number = 2): LoopDetectionResult {
    if (!trace.current_context) {
      return { detected: false, confidence: 0, details: 'No state context available' };
    }

    const currentContext = trace.current_context || 'unknown';
    const currentHash = createHash('md5').update(currentContext).digest('hex');
    
    // Also consider recent actions as part of context for better detection
    const actionContext = trace.recent_actions ? trace.recent_actions.slice(-3).join('->') : '';
    const combinedContext = `${currentContext}|${actionContext}`;
    const combinedHash = createHash('md5').update(combinedContext).digest('hex');

    // Add both hashes to state history
    this.stateHistory.push(currentHash);
    this.stateHistory.push(combinedHash);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    // Count occurrences of current state in recent history
    const currentOccurrences = this.stateHistory.filter(hash => hash === currentHash).length;
    const combinedOccurrences = this.stateHistory.filter(hash => hash === combinedHash).length;
    const occurrences = Math.max(currentOccurrences, combinedOccurrences);
    
    if (occurrences >= threshold) {
      const confidence = Math.min(0.95, 0.7 + (occurrences - threshold) * 0.1);
      return {
        detected: true,
        type: 'state_invariance',
        confidence,
        details: `State revisitation detected: context hash ${currentHash.substring(0, 8)}... visited ${occurrences} times (threshold: ${threshold})`
      };
    }

    // Check for near-identical states (fuzzy matching)
    const similarStates = this.stateHistory.filter(hash => 
      this.calculateHashSimilarity(hash, currentHash) > 0.9
    ).length;

    if (similarStates >= threshold - 1) {
      return {
        detected: true,
        type: 'state_invariance',
        confidence: 0.75,
        details: `Found ${similarStates} similar states suggesting minimal progress`
      };
    }

    return { 
      detected: false, 
      confidence: 0.8, 
      details: `State appears novel, ${occurrences} previous occurrences` 
    };
  }

  /**
   * Strategy 3: Progress Heuristic Evaluation
   * Monitors quantitative progress metrics for stagnation
   */
  detectProgressStagnation(trace: CognitiveTrace, windowSize: number = 6): LoopDetectionResult {
    if (!trace.step_count || trace.step_count < 3) {
      return { detected: false, confidence: 0, details: 'Insufficient step history' };
    }

    const actionCount = trace.recent_actions ? trace.recent_actions.length : 0;
    
    // Calculate action diversity in recent window
    if (actionCount > 0) {
      const recentWindow = trace.recent_actions.slice(-windowSize);
      const uniqueActionsInWindow = new Set(recentWindow).size;
      const diversityRatio = uniqueActionsInWindow / recentWindow.length;
      
      // Low diversity suggests repetitive behavior
      if (diversityRatio < 0.4 && recentWindow.length >= 4) {
        return {
          detected: true,
          type: 'progress_stagnation',
          confidence: 0.8,
          details: `Low action diversity detected: ${(diversityRatio * 100).toFixed(1)}% unique actions in recent window`
        };
      }
    }
    
    // Use step count and action count as simple progress metrics
    const progressRate = actionCount / trace.step_count;
    
    // Check for stagnation patterns
    const stagnationThreshold = 0.3; // 30% progress rate is considered stagnant
    
    if (progressRate < stagnationThreshold && trace.step_count > 5) {
      const confidence = 0.75;
      const details = `Progress stagnation detected: Progress rate=${progressRate.toFixed(3)} (actions/steps)`;
      
      return {
        detected: true,
        type: 'progress_stagnation',
        confidence,
        details
      };
    }

    return { 
      detected: false, 
      confidence: 0.9, 
      details: `Progress trends healthy: Rate=${progressRate.toFixed(3)}, diversity acceptable` 
    };
  }

  /**
   * Hybrid loop detection combining all three strategies
   */
  detectLoop(trace: CognitiveTrace, method: 'statistical' | 'pattern' | 'hybrid' = 'hybrid'): LoopDetectionResult {
    switch (method) {
      case 'statistical':
        return this.detectActionAnomalies(trace);
      case 'pattern':
        return this.detectStateInvariance(trace);
      case 'hybrid':
      default:
        const actionResult = this.detectActionAnomalies(trace);
        const stateResult = this.detectStateInvariance(trace);
        const progressResult = this.detectProgressStagnation(trace);

        // Combine results - if any method detects a loop with high confidence, flag it
        const results = [actionResult, stateResult, progressResult];
        const positiveResults = results.filter(r => r.detected);

        if (positiveResults.length === 0) {
          const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
          return {
            detected: false,
            confidence: avgConfidence,
            details: `No loops detected by any method. ${results.map(r => r.details).join('; ')}`
          };
        }

        // Return the highest confidence positive result
        const bestResult = positiveResults.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );

        return {
          ...bestResult,
          details: `${bestResult.details} (${positiveResults.length}/${results.length} methods agreed)`
        };
    }
  }

  // Helper methods
  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 1.0;
    if (hash1.length !== hash2.length) return 0.0;
    
    let matches = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    return matches / hash1.length;
  }

  /**
   * Update configuration for progress indicators and thresholds
   */
  updateConfig(newConfig: Partial<SentinelConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): SentinelConfig {
    return { ...this.config };
  }

  /**
   * Reset internal state (useful for testing or starting new sessions)
   */
  reset(): void {
    this.stateHistory = [];
  }
}
