import { CognitiveTrace, LoopDetectionResult, SentinelConfig } from './types.js';
import { createHash } from 'crypto';
import * as ss from 'simple-statistics';

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
      progress_threshold_adjustment: config.progress_threshold_adjustment || 0.2,
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
    const actionHashes = actions.map((a) => this.hashAction(a));
    const intervalVariance =
      actionHashes.length > 1 ? ss.variance(actionHashes.map((_, i) => i)) : 0;

    // Combine entropy and variance for anomaly score
    const entropyScore = 1 - normalizedEntropy; // Lower entropy = higher anomaly
    const varianceScore = intervalVariance < 0.1 ? 0.8 : 0.2; // Low variance = repetitive

    return entropyScore * 0.7 + varianceScore * 0.3;
  }

  /**
   * Time series analysis for detecting temporal patterns
   */
  private detectTemporalPatterns(actions: string[]): number {
    if (actions.length < 5) return 0;

    const actionSequence = actions.map((a) => this.hashAction(a));

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
   * Strategy 1: Domain-Agnostic Action Pattern Analysis
   * Detects loops using semantic action similarity and behavioral patterns
   */
  detectActionAnomalies(
    trace: CognitiveTrace & { recent_actions: string[] },
    windowSize: number = 10
  ): LoopDetectionResult {
    if (!trace.recent_actions || trace.recent_actions.length === 0) {
      return { detected: false, confidence: 0, details: 'No action history available' };
    }

    // Use configurable minimum actions threshold to avoid false positives on legitimate exploration
    const minActionsForDetection = Math.max(
      this.config.min_actions_for_detection,
      Math.min(windowSize, 8)
    );
    if (trace.recent_actions.length < minActionsForDetection) {
      return {
        detected: false,
        confidence: 0,
        details: `Insufficient action history: ${trace.recent_actions.length}/${minActionsForDetection} required`,
      };
    }

    const recentActions = trace.recent_actions.slice(-windowSize);

    // Domain-agnostic semantic similarity analysis
    const semanticClusters = this.clusterSemanticallySimilarActions(recentActions);
    const semanticRepetitionRatio = this.calculateSemanticRepetition(
      semanticClusters,
      recentActions.length
    );

    // Extract action parameters for deeper analysis
    const actionParams = recentActions.map((action) => this.extractActionParameters(action));
    const parameterRepetition = this.detectParameterPatterns(actionParams);

    // Check for exact repetition patterns (fallback for simple cases)
    const uniqueActions = new Set(recentActions);
    const exactRepetitionRatio = 1 - uniqueActions.size / recentActions.length;

    // Check for cyclical patterns (A-B-A-B or A-B-C-A-B-C)
    const cyclicalScore = this.detectCyclicalPatterns(recentActions);

    // Check for oscillating patterns (A-B-A-B specifically)
    const oscillationScore = this.detectOscillationPatterns(recentActions);

    // Enhanced pattern detection for alternating actions using semantic similarity
    const alternatingScore = this.detectAlternatingPatterns(semanticClusters, recentActions);

    // Check for configurable progress indicators that suggest positive task advancement
    const hasProgressAction =
      this.config.progress_indicators.length > 0 &&
      recentActions.some((action) =>
        this.config.progress_indicators.some(
          (indicator) => this.semanticSimilarity(action, indicator) > 0.7
        )
      );

    // Calculate combined anomaly score using multiple detection methods
    const anomalyScores = {
      semantic_repetition: semanticRepetitionRatio,
      parameter_repetition: parameterRepetition,
      exact_repetition: exactRepetitionRatio,
      cyclical_pattern: cyclicalScore,
      oscillation_pattern: oscillationScore,
      alternating_pattern: alternatingScore,
      statistical_anomaly: this.detectStatisticalAnomalies(recentActions),
      temporal_pattern: this.detectTemporalPatterns(recentActions),
    };

    // Weight different detection methods based on their reliability
    const weights = {
      semantic_repetition: 0.25,
      parameter_repetition: 0.2,
      exact_repetition: 0.15,
      cyclical_pattern: 0.15,
      oscillation_pattern: 0.1,
      alternating_pattern: 0.1,
      statistical_anomaly: 0.03,
      temporal_pattern: 0.02,
    };

    const combinedAnomalyScore = Object.entries(anomalyScores).reduce((sum, [method, score]) => {
      return sum + score * weights[method as keyof typeof weights];
    }, 0);

    // Adjust threshold based on whether we have progress indicators
    const baseThreshold = 0.35; // More sensitive than before
    const anomalyThreshold = hasProgressAction
      ? baseThreshold + this.config.progress_threshold_adjustment
      : baseThreshold;

    if (combinedAnomalyScore > anomalyThreshold) {
      // Find the most significant detection method
      const dominantMethod = Object.entries(anomalyScores).reduce(
        (max, [method, score]) => (score > max.score ? { method, score } : max),
        { method: '', score: 0 }
      );

      return {
        detected: true,
        type: 'action_repetition',
        confidence: Math.min(0.95, combinedAnomalyScore + 0.1),
        details: `Loop detected via ${dominantMethod.method}: ${(combinedAnomalyScore * 100).toFixed(1)}% anomaly score. Semantic: ${(anomalyScores.semantic_repetition * 100).toFixed(1)}%, Parameter: ${(anomalyScores.parameter_repetition * 100).toFixed(1)}%, Exact: ${(anomalyScores.exact_repetition * 100).toFixed(1)}%, Cyclical: ${(anomalyScores.cyclical_pattern * 100).toFixed(1)}%`,
        actions_involved: Array.from(uniqueActions),
        statistical_metrics: {
          entropy_score: anomalyScores.statistical_anomaly,
          variance_score: anomalyScores.parameter_repetition,
          trend_score: anomalyScores.temporal_pattern,
          cyclicity_score: anomalyScores.cyclical_pattern,
        },
      };
    }

    return {
      detected: false,
      confidence: 1 - combinedAnomalyScore,
      details: `Action diversity acceptable: ${(combinedAnomalyScore * 100).toFixed(1)}% combined anomaly score`,
    };
  }

  /**
   * Strategy 2: Domain-Agnostic State Invariance Tracking
   * Detects when the agent returns to functionally equivalent states
   */
  detectStateInvariance(
    trace: CognitiveTrace & { recent_actions: string[] },
    threshold: number = 2
  ): LoopDetectionResult {
    if (!trace.current_context) {
      return { detected: false, confidence: 0, details: 'No state context available' };
    }

    const currentContext = trace.current_context || 'unknown';

    // Extract structured state information from context
    const stateFeatures = this.extractStateFeatures(currentContext);
    const currentStateHash = this.hashStateFeatures(stateFeatures);

    // Also consider recent actions as part of context for better detection
    const actionContext = trace.recent_actions ? trace.recent_actions.slice(-3).join('->') : '';
    const combinedContext = `${currentContext}|${actionContext}`;
    const combinedStateHash = createHash('md5').update(combinedContext).digest('hex');

    // Add both hashes to state history
    this.stateHistory.push(currentStateHash);
    this.stateHistory.push(combinedStateHash);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    // Count occurrences of current state in recent history
    const currentOccurrences = this.stateHistory.filter((hash) => hash === currentStateHash).length;
    const combinedOccurrences = this.stateHistory.filter(
      (hash) => hash === combinedStateHash
    ).length;
    const exactOccurrences = Math.max(currentOccurrences, combinedOccurrences);

    // Check for semantic state similarity (not just exact matches)
    const semanticSimilarStates = this.stateHistory.filter(
      (hash) => this.calculateSemanticStateSimilarity(hash, currentStateHash, stateFeatures) > 0.8
    ).length;

    const totalSimilarStates = Math.max(exactOccurrences, semanticSimilarStates);

    if (totalSimilarStates >= threshold) {
      const confidence = Math.min(0.95, 0.7 + (totalSimilarStates - threshold) * 0.1);
      return {
        detected: true,
        type: 'state_invariance',
        confidence,
        details: `State revisitation detected: ${totalSimilarStates} similar states found (${exactOccurrences} exact, ${semanticSimilarStates} semantic). Features: ${stateFeatures.slice(0, 3).join(', ')}`,
      };
    }

    // Check for gradual state convergence (states becoming more similar over time)
    const convergenceScore = this.detectStateConvergence(stateFeatures);
    if (convergenceScore > 0.7) {
      return {
        detected: true,
        type: 'state_invariance',
        confidence: 0.8,
        details: `State convergence detected: ${(convergenceScore * 100).toFixed(1)}% convergence score indicating minimal progress`,
      };
    }

    return {
      detected: false,
      confidence: 0.8,
      details: `State appears novel, ${totalSimilarStates} similar states found`,
    };
  }

  /**
   * Strategy 3: Enhanced Progress Heuristic Evaluation
   * Uses advanced time series analysis for stagnation detection
   */
  detectProgressStagnation(
    trace: CognitiveTrace & { recent_actions: string[] },
    windowSize: number = 6
  ): LoopDetectionResult {
    if (!trace.recent_actions.length || trace.recent_actions.length < 3) {
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
          details: `Low action diversity detected: ${(diversityRatio * 100).toFixed(1)}% unique actions in recent window`,
        };
      }
    }

    // Enhanced progress analysis using time series
    const timeSeriesAnalysis = this.analyzeActionTimeSeries(trace);
    const progressRate = actionCount / trace.recent_actions.length;

    // Combine multiple stagnation indicators
    const stagnationScore = Math.max(
      timeSeriesAnalysis.stagnationScore,
      timeSeriesAnalysis.cyclicityScore,
      progressRate < 0.3 ? 0.8 : 0.2
    );

    const stagnationThreshold = 0.6;

    if (stagnationScore > stagnationThreshold && trace.recent_actions.length > 5) {
      const confidence = Math.min(0.95, 0.6 + stagnationScore * 0.3);
      const details = `Advanced stagnation detected: Stagnation=${(stagnationScore * 100).toFixed(1)}%, Trend=${(timeSeriesAnalysis.trendScore * 100).toFixed(1)}%, Cyclicity=${(timeSeriesAnalysis.cyclicityScore * 100).toFixed(1)}%, Progress rate=${progressRate.toFixed(3)}`;

      return {
        detected: true,
        type: 'progress_stagnation',
        confidence,
        details,
      };
    }

    return {
      detected: false,
      confidence: 0.9,
      details: `Progress trends healthy: Rate=${progressRate.toFixed(3)}, diversity acceptable`,
    };
  }

  /**
   * Hybrid loop detection combining all three strategies
   */
  detectLoop(
    trace: CognitiveTrace & { recent_actions: string[] },
    method: 'statistical' | 'pattern' | 'hybrid' = 'hybrid'
  ): LoopDetectionResult {
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
        const positiveResults = results.filter((r) => r.detected);

        if (positiveResults.length === 0) {
          const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
          return {
            detected: false,
            confidence: avgConfidence,
            details: `No loops detected by any method. ${results.map((r) => r.details).join('; ')}`,
          };
        }

        // Return the highest confidence positive result
        const bestResult = positiveResults.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        return {
          ...bestResult,
          details: `${bestResult.details} (${positiveResults.length}/${results.length} methods agreed)`,
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
    actions.forEach((action) => {
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
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 1000; // Normalize to 0-999 range
  }

  /**
   * Advanced time series analysis for detecting complex temporal patterns
   */
  private analyzeActionTimeSeries(trace: CognitiveTrace & { recent_actions: string[] }): {
    trendScore: number;
    cyclicityScore: number;
    stagnationScore: number;
  } {
    const actions = trace.recent_actions;
    if (actions.length < 4) {
      return { trendScore: 0, cyclicityScore: 0, stagnationScore: 0 };
    }

    // Convert actions to numerical sequence for analysis
    const actionSequence = actions.map((a: string) => this.hashAction(a));

    // Calculate trend using linear regression
    const xValues = actionSequence.map((_: number, i: number) => i);
    const yValues = actionSequence;

    const n = actionSequence.length;
    const sumX = xValues.reduce((sum: number, x: number) => sum + x, 0);
    const sumY = yValues.reduce((sum: number, y: number) => sum + y, 0);
    const sumXY = xValues.reduce((sum: number, x: number, i: number) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum: number, x: number) => sum + x * x, 0);

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
        const angle = (2 * Math.PI * k * t) / n;
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

  // Domain-Agnostic Helper Methods

  /**
   * Cluster actions by semantic similarity to detect repeated intentions
   */
  private clusterSemanticallySimilarActions(actions: string[]): string[][] {
    const clusters: string[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < actions.length; i++) {
      if (processed.has(i)) continue;

      const cluster = [actions[i]];
      processed.add(i);

      for (let j = i + 1; j < actions.length; j++) {
        if (processed.has(j)) continue;

        if (this.semanticSimilarity(actions[i], actions[j]) > 0.7) {
          cluster.push(actions[j]);
          processed.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Calculate semantic similarity between two action strings
   */
  private semanticSimilarity(action1: string, action2: string): number {
    // Extract action name and parameters
    const parsed1 = this.extractActionParameters(action1);
    const parsed2 = this.extractActionParameters(action2);

    // If action names are identical, they're semantically similar
    if (parsed1.name === parsed2.name) {
      return 0.8 + this.parameterSimilarity(parsed1.params, parsed2.params) * 0.2;
    }

    // Check for semantically similar action names
    const nameSimilarity = this.tokenSimilarity(parsed1.name, parsed2.name);
    return nameSimilarity * 0.6 + this.parameterSimilarity(parsed1.params, parsed2.params) * 0.4;
  }

  /**
   * Extract action name and parameters from action string
   */
  private extractActionParameters(action: string): { name: string; params: string[] } {
    // Handle various action formats:
    // "scroll_down(500)" -> name: "scroll_down", params: ["500"]
    // "click_element button" -> name: "click_element", params: ["button"]
    // "navigate_to_page" -> name: "navigate_to_page", params: []

    const match = action.match(/^([^(]+)(?:\(([^)]*)\))?(.*)$/);
    if (!match) return { name: action, params: [] };

    const name = match[1].trim();
    const parenParams = match[2] ? match[2].split(',').map((p) => p.trim()) : [];
    const spaceParams = match[3]
      ? match[3]
          .trim()
          .split(/\s+/)
          .filter((p) => p)
      : [];

    return { name, params: [...parenParams, ...spaceParams] };
  }

  /**
   * Calculate similarity between parameter sets
   */
  private parameterSimilarity(params1: string[], params2: string[]): number {
    if (params1.length === 0 && params2.length === 0) return 1.0;
    if (params1.length === 0 || params2.length === 0) return 0.0;

    const intersection = params1.filter((p) => params2.includes(p));
    const union = [...new Set([...params1, ...params2])];

    return intersection.length / union.length; // Jaccard similarity
  }

  /**
   * Calculate token-level similarity between strings
   */
  private tokenSimilarity(str1: string, str2: string): number {
    const tokens1 = str1.toLowerCase().split(/[_\s]+/);
    const tokens2 = str2.toLowerCase().split(/[_\s]+/);

    const intersection = tokens1.filter((t) => tokens2.includes(t));
    const union = [...new Set([...tokens1, ...tokens2])];

    return intersection.length / union.length;
  }

  /**
   * Calculate semantic repetition ratio from clustered actions
   */
  private calculateSemanticRepetition(clusters: string[][], totalActions: number): number {
    if (totalActions === 0) return 0;

    // Count actions in clusters with more than one member
    const repeatedActions = clusters.reduce((count, cluster) => {
      return cluster.length > 1 ? count + cluster.length : count;
    }, 0);

    return repeatedActions / totalActions;
  }

  /**
   * Detect patterns in action parameters
   */
  private detectParameterPatterns(actionParams: Array<{ name: string; params: string[] }>): number {
    if (actionParams.length < 3) return 0;

    // Group by action name
    const actionGroups = new Map<string, string[][]>();
    actionParams.forEach(({ name, params }) => {
      if (!actionGroups.has(name)) actionGroups.set(name, []);
      actionGroups.get(name)!.push(params);
    });

    let totalPatterns = 0;
    let totalComparisons = 0;

    // Look for parameter patterns within each action group
    for (const [, paramsList] of actionGroups) {
      if (paramsList.length < 2) continue;

      for (let i = 0; i < paramsList.length - 1; i++) {
        for (let j = i + 1; j < paramsList.length; j++) {
          totalComparisons++;

          // Check if parameters are identical or follow a pattern
          const similarity = this.parameterSimilarity(paramsList[i], paramsList[j]);
          if (similarity > 0.7) {
            totalPatterns++;
          }
        }
      }
    }

    return totalComparisons > 0 ? totalPatterns / totalComparisons : 0;
  }

  /**
   * Detect cyclical patterns in action sequences
   */
  private detectCyclicalPatterns(actions: string[]): number {
    if (actions.length < 4) return 0;

    let maxCyclicity = 0;

    // Check for cycles of length 2 to actions.length/2
    for (let cycleLen = 2; cycleLen <= Math.floor(actions.length / 2); cycleLen++) {
      let matches = 0;
      let comparisons = 0;

      for (let i = 0; i < actions.length - cycleLen; i++) {
        if (i + cycleLen < actions.length) {
          comparisons++;
          if (this.semanticSimilarity(actions[i], actions[i + cycleLen]) > 0.7) {
            matches++;
          }
        }
      }

      if (comparisons > 0) {
        const cyclicity = matches / comparisons;
        maxCyclicity = Math.max(maxCyclicity, cyclicity);
      }
    }

    return maxCyclicity;
  }

  /**
   * Detect oscillation patterns (A-B-A-B)
   */
  private detectOscillationPatterns(actions: string[]): number {
    if (actions.length < 4) return 0;

    let oscillations = 0;
    let checks = 0;

    for (let i = 0; i < actions.length - 3; i++) {
      checks++;
      if (
        this.semanticSimilarity(actions[i], actions[i + 2]) > 0.7 &&
        this.semanticSimilarity(actions[i + 1], actions[i + 3]) > 0.7 &&
        this.semanticSimilarity(actions[i], actions[i + 1]) < 0.7
      ) {
        oscillations++;
      }
    }

    return checks > 0 ? oscillations / checks : 0;
  }

  /**
   * Detect alternating patterns using semantic clusters
   */
  private detectAlternatingPatterns(clusters: string[][], actions: string[]): number {
    if (actions.length < 4) return 0;

    // Create a mapping from action to cluster ID
    const actionToCluster = new Map<string, number>();
    clusters.forEach((cluster, clusterId) => {
      cluster.forEach((action) => actionToCluster.set(action, clusterId));
    });

    // Convert actions to cluster sequence
    const clusterSequence = actions.map((action) => actionToCluster.get(action) ?? -1);

    let alternations = 0;
    let checks = 0;

    for (let i = 0; i < clusterSequence.length - 3; i++) {
      checks++;
      if (
        clusterSequence[i] === clusterSequence[i + 2] &&
        clusterSequence[i + 1] === clusterSequence[i + 3] &&
        clusterSequence[i] !== clusterSequence[i + 1]
      ) {
        alternations++;
      }
    }

    return checks > 0 ? alternations / checks : 0;
  }

  /**
   * Extract domain-agnostic state features from context string
   */
  private extractStateFeatures(context: string): string[] {
    // Extract various types of state information that might be present
    const features: string[] = [];

    // Extract numbers (positions, counts, IDs, etc.)
    const numbers = context.match(/\d+/g) || [];
    features.push(...numbers.map((n) => `num:${n}`));

    // Extract quoted strings (element text, URLs, etc.)
    const quotedStrings = context.match(/"([^"]+)"/g) || [];
    features.push(...quotedStrings.map((s) => `text:${s.replace(/"/g, '')}`));

    // Extract URLs or paths
    const urlPattern = /https?:\/\/[^\s]+|\/[^\s]*/g;
    const urls = context.match(urlPattern) || [];
    features.push(...urls.map((u) => `url:${u}`));

    // Extract key-value pairs (JSON-like or structured data)
    const keyValuePattern = /(\w+):\s*([^,\s}]+)/g;
    let match;
    while ((match = keyValuePattern.exec(context)) !== null) {
      features.push(`kv:${match[1]}=${match[2]}`);
    }

    // Extract common state indicators
    const stateIndicators = [
      'visible',
      'hidden',
      'enabled',
      'disabled',
      'active',
      'inactive',
      'loading',
      'loaded',
      'error',
      'success',
    ];
    stateIndicators.forEach((indicator) => {
      if (context.toLowerCase().includes(indicator)) {
        features.push(`state:${indicator}`);
      }
    });

    // Extract words that might represent important entities
    const words = context.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const commonWords = new Set([
      'the',
      'and',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'was',
      'one',
      'our',
      'out',
      'day',
      'get',
      'has',
      'him',
      'how',
      'man',
      'new',
      'now',
      'old',
      'see',
      'two',
      'way',
      'who',
      'boy',
      'did',
      'its',
      'let',
      'put',
      'say',
      'she',
      'too',
      'use',
    ]);
    const importantWords = words.filter((word) => !commonWords.has(word));
    features.push(...importantWords.slice(0, 10).map((w) => `word:${w}`));

    return features;
  }

  /**
   * Create a hash from state features for comparison
   */
  private hashStateFeatures(features: string[]): string {
    const sortedFeatures = features.sort().join('|');
    return createHash('md5').update(sortedFeatures).digest('hex');
  }

  /**
   * Calculate semantic similarity between state hashes using their features
   */
  private calculateSemanticStateSimilarity(
    hash1: string,
    hash2: string,
    currentFeatures: string[]
  ): number {
    // For now, we'll use a simple approach - in a real implementation,
    // you might want to store features alongside hashes
    if (hash1 === hash2) return 1.0;

    // Calculate character-level similarity as a proxy for semantic similarity
    return this.calculateHashSimilarity(hash1, hash2);
  }

  /**
   * Detect if states are converging over time (becoming more similar)
   */
  private detectStateConvergence(currentFeatures: string[]): number {
    if (this.stateHistory.length < 4) return 0;

    // Take the last few states and compare their similarity to current state
    const recentStates = this.stateHistory.slice(-4);
    let totalSimilarity = 0;
    let comparisons = 0;

    for (const stateHash of recentStates) {
      // This is a simplified approach - in a full implementation,
      // you'd want to store features alongside hashes
      totalSimilarity += this.calculateHashSimilarity(
        stateHash,
        this.hashStateFeatures(currentFeatures)
      );
      comparisons++;
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }
}
