import { CognitiveTrace, LoopDetectionResult, SentinelConfig } from './types.js';
import { createHash } from 'crypto';
import * as ss from 'simple-statistics';
import { distance } from 'ml-distance';

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
   * Enhanced statistical anomaly detection using entropy and advanced metrics
   */
  private detectStatisticalAnomalies(actions: string[]): number {
    if (actions.length < 3) return 0;
    
    const actionFrequencies = this.calculateActionFrequencies(actions);
    const frequencies = Object.values(actionFrequencies);
    
    // Calculate entropy-based anomaly score
    const entropy = this.calculateEntropy(frequencies);
    const maxEntropy = Math.log2(Object.keys(actionFrequencies).length);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
    
    // Calculate standard deviation of action intervals
    const actionHashes = actions.map(a => this.hashAction(a));
    const intervalVariance = actionHashes.length > 1 ? 
      ss.variance(actionHashes.map((_, i) => i)) : 0;
    
    // Combine entropy and variance for anomaly score
    const entropyScore = 1 - normalizedEntropy; // Lower entropy = higher anomaly
    const varianceScore = intervalVariance < 0.1 ? 0.8 : 0.2; // Low variance = repetitive
    
    return (entropyScore * 0.7) + (varianceScore * 0.3);
  }

  /**
   * Time series analysis for detecting temporal patterns
   */
  private detectTemporalPatterns(actions: string[], timestamps?: number[]): number {
    if (actions.length < 5) return 0;
    
    const actionSequence = actions.map(a => this.hashAction(a));
    
    // Calculate autocorrelation to detect periodic patterns
    const autocorr = this.calculateAutocorrelation(actionSequence, 1);
    const periodicityScore = Math.abs(autocorr);
    
    // Moving average to detect trend changes
    const movingAvg = this.calculateMovingAverage(actionSequence, 3);
    const trendVariance = movingAvg.length > 1 ? ss.variance(movingAvg) : 0;
    
    // High periodicity + low trend variance = stuck pattern
    return periodicityScore > 0.7 && trendVariance < 0.1 ? 0.8 : 0.2;
  }

  /**
   * Strategy 1: Action Trace Analysis & Anomaly Detection
   * Enhanced with advanced statistical methods
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

    // Enhanced anomaly detection with statistical analysis
    const statisticalAnomalyScore = this.detectStatisticalAnomalies(actionTypes);
    const temporalPatternScore = this.detectTemporalPatterns(actionTypes);
    
    // Combine all detection methods
    const basicAnomalyScore = Math.max(repetitionRatio, oscillationRatio, alternatingRatio);
    const anomalyScore = Math.max(
      basicAnomalyScore,
      statisticalAnomalyScore,
      temporalPatternScore
    );
    
    // Adjust threshold based on whether we have progress indicators
    const anomalyThreshold = hasProgressAction ? 
      Math.max(0.6, this.config.alternating_threshold + this.config.progress_threshold_adjustment) : 
      Math.max(0.5, this.config.alternating_threshold);
    
    if (anomalyScore > anomalyThreshold) {
      return {
        detected: true,
        type: 'action_repetition',
        confidence: Math.min(0.95, anomalyScore + 0.1), // Conservative confidence boost
        details: `Advanced pattern detected: ${(anomalyScore * 100).toFixed(1)}% anomaly score. Repetition: ${(repetitionRatio * 100).toFixed(1)}%, Oscillation: ${(oscillationRatio * 100).toFixed(1)}%, Alternating: ${(alternatingRatio * 100).toFixed(1)}%, Statistical: ${(statisticalAnomalyScore * 100).toFixed(1)}%, Temporal: ${(temporalPatternScore * 100).toFixed(1)}%`,
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
   * Strategy 3: Enhanced Progress Heuristic Evaluation
   * Uses advanced time series analysis for stagnation detection
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
    
    // Enhanced progress analysis using time series
    const timeSeriesAnalysis = this.analyzeActionTimeSeries(trace);
    const progressRate = actionCount / trace.step_count;
    
    // Combine multiple stagnation indicators
    const stagnationScore = Math.max(
      timeSeriesAnalysis.stagnationScore,
      timeSeriesAnalysis.cyclicityScore,
      progressRate < 0.3 ? 0.8 : 0.2
    );
    
    const stagnationThreshold = 0.6;
    
    if (stagnationScore > stagnationThreshold && trace.step_count > 5) {
      const confidence = Math.min(0.95, 0.6 + stagnationScore * 0.3);
      const details = `Advanced stagnation detected: Stagnation=${(stagnationScore * 100).toFixed(1)}%, Trend=${(timeSeriesAnalysis.trendScore * 100).toFixed(1)}%, Cyclicity=${(timeSeriesAnalysis.cyclicityScore * 100).toFixed(1)}%, Progress rate=${progressRate.toFixed(3)}`;
      
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
   * Helper method to calculate action frequencies
   */
  private calculateActionFrequencies(actions: string[]): Record<string, number> {
    const frequencies: Record<string, number> = {};
    actions.forEach(action => {
      frequencies[action] = (frequencies[action] || 0) + 1;
    });
    return frequencies;
  }

  /**
   * Helper method to hash actions for numerical analysis
   */
  private hashAction(action: string): number {
    let hash = 0;
    for (let i = 0; i < action.length; i++) {
      const char = action.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 1000; // Normalize to 0-999 range
  }

  /**
   * Enhanced state similarity using statistical distance
   */
  private calculateStatisticalSimilarity(state1: string, state2: string): number {
    const tokens1 = state1.toLowerCase().split(/\s+/);
    const tokens2 = state2.toLowerCase().split(/\s+/);
    
    // Convert to frequency vectors
    const allTokens = [...new Set([...tokens1, ...tokens2])];
    const vector1 = allTokens.map(token => tokens1.filter(t => t === token).length);
    const vector2 = allTokens.map(token => tokens2.filter(t => t === token).length);
    
    // Calculate euclidean distance
    const euclideanDistance = distance.euclidean(vector1, vector2);
    const maxDistance = Math.sqrt(Math.max(vector1.length, vector2.length));
    
    return 1 - (euclideanDistance / maxDistance); // Convert to similarity score
  }

  /**
   * Advanced time series analysis for detecting complex temporal patterns
   */
  private analyzeActionTimeSeries(trace: CognitiveTrace): {
    trendScore: number;
    cyclicityScore: number;
    stagnationScore: number;
  } {
    const actions = trace.recent_actions;
    if (actions.length < 4) {
      return { trendScore: 0, cyclicityScore: 0, stagnationScore: 0 };
    }
    
    // Convert actions to numerical sequence for analysis
    const actionSequence = actions.map(a => this.hashAction(a));
    
    // Calculate trend using linear regression
    const xValues = actionSequence.map((_, i) => i);
    const yValues = actionSequence;
    
    const n = actionSequence.length;
    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const trendScore = Math.abs(slope) < 0.1 ? 0.8 : 0.2; // Low slope = stagnation
    
    // Detect cyclicity using frequency analysis
    const fft = this.simpleFFT(actionSequence);
    const dominantFrequency = this.findDominantFrequency(fft);
    const cyclicityScore = dominantFrequency > 0.3 ? 0.9 : 0.1;
    
    // Calculate stagnation using variance
    const variance = ss.variance(actionSequence);
    const stagnationScore = variance < 10 ? 0.8 : 0.2;
    
    return { trendScore, cyclicityScore, stagnationScore };
  }

  /**
   * Simple FFT implementation for frequency analysis
   */
  private simpleFFT(sequence: number[]): number[] {
    const n = sequence.length;
    if (n <= 1) return sequence;
    
    // Simplified DFT for detecting dominant frequencies
    const frequencies: number[] = [];
    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * k * t / n;
        real += sequence[t] * Math.cos(angle);
        imag += sequence[t] * Math.sin(angle);
      }
      frequencies.push(Math.sqrt(real * real + imag * imag));
    }
    return frequencies;
  }

  /**
   * Find dominant frequency in FFT output
   */
  private findDominantFrequency(fft: number[]): number {
    if (fft.length === 0) return 0;
    const max = Math.max(...fft);
    const total = fft.reduce((sum, val) => sum + val, 0);
    return total > 0 ? max / total : 0;
  }

  /**
   * Calculate entropy manually since simple-statistics doesn't have it
   */
  private calculateEntropy(frequencies: number[]): number {
    const total = frequencies.reduce((sum, freq) => sum + freq, 0);
    if (total === 0) return 0;
    
    return frequencies.reduce((entropy, freq) => {
      if (freq === 0) return entropy;
      const probability = freq / total;
      return entropy - probability * Math.log2(probability);
    }, 0);
  }

  /**
   * Calculate autocorrelation manually
   */
  private calculateAutocorrelation(sequence: number[], lag: number): number {
    if (sequence.length <= lag) return 0;
    
    const mean = ss.mean(sequence);
    const variance = ss.variance(sequence);
    if (variance === 0) return 0;
    
    let correlation = 0;
    const n = sequence.length - lag;
    
    for (let i = 0; i < n; i++) {
      correlation += (sequence[i] - mean) * (sequence[i + lag] - mean);
    }
    
    return correlation / (n * variance);
  }

  /**
   * Calculate moving average manually
   */
  private calculateMovingAverage(sequence: number[], windowSize: number): number[] {
    if (sequence.length < windowSize) return [];
    
    const result: number[] = [];
    for (let i = 0; i <= sequence.length - windowSize; i++) {
      const window = sequence.slice(i, i + windowSize);
      result.push(ss.mean(window));
    }
    return result;
  }

  /**
   * Reset internal state (useful for testing or starting new sessions)
   */
  reset(): void {
    this.stateHistory = [];
  }
}
