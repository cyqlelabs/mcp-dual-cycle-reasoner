import { CognitiveTrace, LoopDetectionResult, SentinelConfig } from './types.js';
import { createHash } from 'crypto';
import * as ss from 'simple-statistics';
import { semanticAnalyzer } from './semantic-analyzer.js';

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
      semantic_intents: config.semantic_intents || [
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
      ],
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
  async detectActionAnomalies(
    trace: CognitiveTrace & { recent_actions: string[] },
    windowSize: number = 10
  ): Promise<LoopDetectionResult> {
    if (
      !trace.recent_actions ||
      !Array.isArray(trace.recent_actions) ||
      trace.recent_actions.length === 0
    ) {
      return {
        detected: false,
        confidence: 0,
        details: {},
      };
    }

    // Use configurable minimum actions threshold to avoid false positives on legitimate exploration
    const minActionsForDetection = Math.max(
      this.config.min_actions_for_detection,
      Math.floor(windowSize * 0.3)
    );
    if (trace.recent_actions.length < minActionsForDetection) {
      return {
        detected: false,
        confidence: 0,
        details: {},
      };
    }

    const recentActions = trace.recent_actions.slice(-windowSize);

    // PERFORMANCE OPTIMIZATION: Compute similarity matrix once for all semantic operations
    const similarityMatrix = await semanticAnalyzer.computeSimilarityMatrix(recentActions);

    // Domain-agnostic semantic similarity analysis using precomputed matrix
    const semanticClusters = this.clusterWithPrecomputedSimilarity(recentActions, similarityMatrix);
    const semanticRepetitionRatio = this.calculateSemanticRepetition(
      semanticClusters,
      recentActions.length
    );

    // Extract action parameters for deeper analysis
    const actionParams = recentActions.map((action) => this.extractActionParameters(action));
    const parameterRepetition = this.detectParameterPatterns(recentActions, semanticClusters);

    // Check for exact repetition patterns (fallback for simple cases)
    const uniqueActions = new Set(recentActions);
    const exactRepetitionRatio = 1 - uniqueActions.size / recentActions.length;

    // Check for cyclical patterns using precomputed similarities
    const cyclicalScore = await this.detectCyclicalPatterns(recentActions, similarityMatrix);

    // Check for oscillating patterns using precomputed similarities
    const oscillationScore = await this.detectOscillationPatterns(recentActions, similarityMatrix);

    // Enhanced pattern detection for alternating actions using semantic similarity
    const alternatingScore = this.detectAlternatingPatterns(semanticClusters, recentActions);

    // Check for configurable progress indicators that suggest positive task advancement
    const hasProgressAction = await this.checkProgressIndicators(recentActions);

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
    const baseThreshold = 0.25; // Even more sensitive for better detection
    const anomalyThreshold = hasProgressAction
      ? baseThreshold + this.config.progress_threshold_adjustment
      : baseThreshold;

    if (combinedAnomalyScore > anomalyThreshold) {
      // Find the most significant detection method
      const dominantMethod = Object.entries(anomalyScores).reduce(
        (max, [method, score]) => (score > max.score ? { method, score } : max),
        { method: '', score: 0 }
      );

      // Identify specific actions involved in the loop based on dominant method
      const specificActionsInvolved = this.getActionsInvolvedInLoop(
        dominantMethod.method,
        recentActions,
        semanticClusters
      );

      return {
        detected: true,
        type: 'action_repetition',
        confidence: Math.min(0.95, combinedAnomalyScore + 0.3),
        details: {
          dominant_method: dominantMethod.method,
          anomaly_score: combinedAnomalyScore,
          actions_involved_count: specificActionsInvolved.length,
          recent_actions_count: recentActions.length,
          metrics: anomalyScores,
        },
        actions_involved: specificActionsInvolved,
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
      details: {
        anomaly_score: combinedAnomalyScore,
        metrics: anomalyScores,
      },
      statistical_metrics: {
        entropy_score: anomalyScores.statistical_anomaly,
        variance_score: anomalyScores.parameter_repetition,
        trend_score: anomalyScores.temporal_pattern,
        cyclicity_score: anomalyScores.cyclical_pattern,
      },
    };
  }

  /**
   * Strategy 2: Domain-Agnostic State Invariance Tracking
   * Detects when the agent returns to functionally equivalent states
   */
  detectStateInvariance(
    trace: CognitiveTrace & { recent_actions: string[] },
    threshold: number = 2,
    windowSize: number = 10
  ): LoopDetectionResult {
    if (!trace.current_context) {
      return {
        detected: false,
        confidence: 0,
        details: {},
      };
    }

    // Use same action history requirements as detectActionAnomalies for consistency
    const minActionsForDetection = Math.max(
      this.config.min_actions_for_detection,
      Math.floor(windowSize * 0.3)
    );
    if (trace.recent_actions.length < minActionsForDetection) {
      return {
        detected: false,
        confidence: 0,
        details: {},
      };
    }

    const currentContext = trace.current_context || 'unknown';

    // Extract structured state information from context
    const stateFeatures = this.extractStateFeatures(currentContext);
    const currentStateHash = this.hashStateFeatures(stateFeatures);

    // Also consider recent actions as part of context for better detection
    const actionContext =
      trace.recent_actions && Array.isArray(trace.recent_actions)
        ? trace.recent_actions.slice(-3).join('->')
        : '';
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

      // Get actions that led to state revisitation (recent actions that brought us back to similar state)
      const recentActions = trace.recent_actions.slice(-windowSize);
      const actionCounts = new Map<string, number>();
      recentActions.forEach((action) => {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      });

      const stateInvarianceActions = Array.from(actionCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([action]) => action);

      return {
        detected: true,
        type: 'state_invariance',
        confidence,
        details: {
          metrics: {
            total_similar_states: totalSimilarStates,
            exact_occurrences: exactOccurrences,
            semantic_similar_states: semanticSimilarStates,
            features: stateFeatures.slice(0, 3).join(', '),
          },
        },
        actions_involved: stateInvarianceActions,
      };
    }

    // Check for gradual state convergence (states becoming more similar over time)
    const convergenceScore = this.detectStateConvergence(stateFeatures);
    if (convergenceScore > 0.7) {
      // Get actions involved in state convergence (recent actions)
      const recentActions = trace.recent_actions.slice(-windowSize);
      const actionCounts = new Map<string, number>();
      recentActions.forEach((action) => {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      });

      const convergenceActions = Array.from(actionCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([action]) => action);

      return {
        detected: true,
        type: 'state_invariance',
        confidence: 0.8,
        details: {
          metrics: {
            convergence_score: convergenceScore,
          },
        },
        actions_involved: convergenceActions,
      };
    }

    return {
      detected: false,
      confidence: 0.8,
      details: {
        metrics: {
          total_similar_states: totalSimilarStates,
        },
      },
    };
  }

  /**
   * Strategy 3: Enhanced Progress Heuristic Evaluation
   * Uses domain-agnostic analysis with progressive thresholds for stagnation detection
   */
  async detectProgressStagnation(
    trace: CognitiveTrace & { recent_actions: string[] },
    windowSize: number = 8,
    similarityMatrix?: number[][]
  ): Promise<LoopDetectionResult> {
    const minActionsForDetection = Math.max(
      this.config.min_actions_for_detection,
      Math.floor(windowSize * 0.3)
    );
    if (
      !trace.recent_actions ||
      !Array.isArray(trace.recent_actions) ||
      trace.recent_actions.length < minActionsForDetection
    ) {
      return {
        detected: false,
        confidence: 0,
        details: {},
      };
    }

    const actionCount = trace.recent_actions.length;

    // Multi-window analysis: short-term vs long-term patterns
    const shortWindow = trace.recent_actions.slice(-Math.min(5, actionCount));
    const longWindow = trace.recent_actions.slice(-Math.min(windowSize, actionCount));

    // Calculate diversity for both windows
    const shortDiversity = new Set(shortWindow).size / shortWindow.length;
    const longDiversity = new Set(longWindow).size / longWindow.length;

    // Progressive threshold: becomes more lenient with more actions (allows for longer exploration)
    const baseThreshold = 0.25; // More permissive base threshold
    const progressiveFactor = Math.min(0.1, (actionCount - 6) * 0.01); // Gradual increase
    const diversityThreshold = baseThreshold + progressiveFactor;

    // Advanced pattern analysis with optional precomputed similarity matrix
    const timeSeriesAnalysis = this.analyzeActionTimeSeries(trace);
    const actionChangeVelocity = this.calculateActionChangeVelocity(trace.recent_actions);
    const semanticVariation = await this.calculateSemanticVariation(
      trace.recent_actions,
      similarityMatrix
    );

    // Multi-factor stagnation score
    const diversityScore = 1 - longDiversity;
    const stagnationScore =
      diversityScore * 0.4 +
      timeSeriesAnalysis.stagnationScore * 0.3 +
      (1 - actionChangeVelocity) * 0.2 +
      (1 - semanticVariation) * 0.1;

    // Dynamic threshold that adapts to action count
    const dynamicThreshold = Math.min(0.75, 0.55 + (actionCount - 8) * 0.015);

    // Primary detection: extremely low diversity (likely stuck)
    if (longDiversity < diversityThreshold && longWindow.length >= 6) {
      const actionCounts = new Map<string, number>();
      longWindow.forEach((action) => {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      });

      const lowDiversityActions = Array.from(actionCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([action]) => action);

      const confidence = Math.min(0.9, 0.6 + (1 - longDiversity) * 0.8);

      return {
        detected: true,
        type: 'progress_stagnation',
        confidence,
        details: {
          metrics: {
            diversity: longDiversity,
            threshold: diversityThreshold,
            actions_analyzed: longWindow.length,
          },
        },
        actions_involved: lowDiversityActions,
      };
    }

    // Secondary detection: multi-factor stagnation analysis
    if (stagnationScore > dynamicThreshold && actionCount >= minActionsForDetection) {
      const confidence = Math.min(0.95, 0.5 + stagnationScore * 0.5);

      const recentActions = trace.recent_actions.slice(-windowSize);
      const actionCounts = new Map<string, number>();
      recentActions.forEach((action) => {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      });

      const stagnationActions = Array.from(actionCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([action]) => action);

      return {
        detected: true,
        type: 'progress_stagnation',
        confidence,
        details: {
          metrics: {
            stagnation_score: stagnationScore,
            diversity: longDiversity,
            velocity: actionChangeVelocity,
            variation: semanticVariation,
            threshold: dynamicThreshold,
          },
        },
        actions_involved: stagnationActions,
      };
    }

    return {
      detected: false,
      confidence: 0.8,
      details: {
        metrics: {
          diversity: longDiversity,
          stagnation_score: stagnationScore,
          velocity: actionChangeVelocity,
        },
      },
    };
  }

  /**
   * Hybrid loop detection combining all three strategies
   */
  async detectLoop(
    trace: CognitiveTrace & { recent_actions: string[] },
    method: 'statistical' | 'pattern' | 'hybrid' = 'hybrid',
    windowSize: number = 10
  ): Promise<LoopDetectionResult> {
    switch (method) {
      case 'statistical':
        return await this.detectActionAnomalies(trace, windowSize);
      case 'pattern':
        return this.detectStateInvariance(trace, 2, windowSize);
      case 'hybrid':
      default:
        const actionResult = await this.detectActionAnomalies(trace, windowSize);
        const stateResult = this.detectStateInvariance(trace, 2, windowSize);
        const progressResult = await this.detectProgressStagnation(trace, windowSize);

        // Combine results - if any method detects a loop with high confidence, flag it
        const results = [actionResult, stateResult, progressResult];
        const positiveResults = results.filter((r) => r.detected);

        if (positiveResults.length === 0) {
          const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
          return {
            detected: false,
            confidence: avgConfidence,
            details: {
              metrics: {
                action_anomaly_score: actionResult.details.anomaly_score,
                state_invariance_confidence: stateResult.confidence,
                progress_stagnation_score: progressResult.details.metrics?.stagnation_score,
              },
            },
          };
        }

        // Return the highest confidence positive result
        const bestResult = positiveResults.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        return {
          ...bestResult,
          details: {
            ...bestResult.details,
          },
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
    if (!actions || !Array.isArray(actions) || actions.length < 4) {
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

  /**
   * Identify specific actions involved in the loop based on dominant detection method
   */
  private getActionsInvolvedInLoop(
    dominantMethod: string,
    recentActions: string[],
    semanticClusters: string[][]
  ): string[] {
    switch (dominantMethod) {
      case 'semantic_repetition':
        // Return actions from the largest semantic cluster (most repeated semantic actions)
        const largestCluster = semanticClusters.reduce(
          (max, cluster) => (cluster.length > max.length ? cluster : max),
          []
        );
        return largestCluster.length > 1 ? [...new Set(largestCluster)] : [];

      case 'parameter_repetition':
        // Return actions with repeated parameters using existing logic
        return this.getParameterRepeatedActions(recentActions, semanticClusters);

      case 'exact_repetition':
        // Return actions that appear multiple times exactly
        const actionCounts = new Map<string, number>();
        recentActions.forEach((action) => {
          actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
        });
        return [...new Set(recentActions.filter((action) => actionCounts.get(action)! > 1))];

      case 'cyclical_pattern':
      case 'oscillation_pattern':
      case 'alternating_pattern':
        // For pattern-based detection, return actions from the most frequent semantic cluster
        const dominantCluster = semanticClusters.reduce(
          (max, cluster) => (cluster.length > max.length ? cluster : max),
          []
        );
        return dominantCluster.length > 1 ? [...new Set(dominantCluster)] : [];

      default:
        // Fallback: return actions from largest semantic cluster
        const defaultCluster = semanticClusters.reduce(
          (max, cluster) => (cluster.length > max.length ? cluster : max),
          []
        );
        return defaultCluster.length > 1 ? [...new Set(defaultCluster)] : [];
    }
  }

  /**
   * Get actions with repeated parameters by leveraging existing parameter detection logic
   */
  private getParameterRepeatedActions(
    recentActions: string[],
    semanticClusters: string[][]
  ): string[] {
    const actionToParams = new Map<string, string[]>();
    recentActions.forEach((action) => {
      actionToParams.set(action, this.extractActionParameters(action).params);
    });

    const repeatedActions: string[] = [];

    // For each semantic cluster, find parameters with high similarity
    for (const cluster of semanticClusters) {
      if (cluster.length < 2) continue;

      for (let i = 0; i < cluster.length - 1; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const params1 = actionToParams.get(cluster[i])!;
          const params2 = actionToParams.get(cluster[j])!;
          const similarity = this.parameterSimilarity(params1, params2);
          if (similarity > 0.7) {
            repeatedActions.push(cluster[i]);
            repeatedActions.push(cluster[j]);
          }
        }
      }
    }

    return [...new Set(repeatedActions)];
  }

  // Domain-Agnostic Helper Methods

  /**
   * PERFORMANCE OPTIMIZED: Cluster actions using precomputed similarity matrix
   */
  private clusterWithPrecomputedSimilarity(
    actions: string[],
    similarityMatrix: number[][]
  ): string[][] {
    if (actions.length === 0) return [];
    if (actions.length === 1) return [actions];

    const clusters: string[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < actions.length; i++) {
      if (processed.has(i)) continue;

      const cluster = [actions[i]];
      processed.add(i);

      for (let j = i + 1; j < actions.length; j++) {
        if (processed.has(j)) continue;

        // Use precomputed similarity instead of individual model call
        if (similarityMatrix[i][j] > 0.7) {
          cluster.push(actions[j]);
          processed.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Calculate semantic similarity between two action strings using semantic analyzer
   */
  private async semanticSimilarity(action1: string, action2: string): Promise<number> {
    const result = await semanticAnalyzer.calculateSemanticSimilarity(action1, action2);
    return result.similarity;
  }

  /**
   * Extract action name and parameters from action string
   */
  private extractActionParameters(action: string): { name: string; params: string[] } {
    // Handle various action formats and normalize action names by extracting underscored parameters.
    // "click_element_by_index_index_0" -> name: "click_element_by_index", params: ["index_0"]
    const match = action.match(/^([^(]+)(?:\(([^)]*)\))?(.*)$/);
    if (!match) return { name: action, params: [] };

    const originalName = match[1].trim();
    const parenParams = match[2] ? match[2].split(',').map((p) => p.trim()) : [];
    const spaceParams = match[3]
      ? match[3]
          .trim()
          .split(/\s+/)
          .filter((p) => p)
      : [];

    // A regex to find and extract underscore-appended parameters like _index_0 or _id_12345
    const paramRegex = /_([a-zA-Z][a-zA-Z0-9]*)_(\d+)$/;
    let name = originalName;
    const potentialParams: string[] = [];

    // Repeatedly match to handle multiple appended parameters like _x_1_y_2
    let regexMatch;
    while ((regexMatch = name.match(paramRegex))) {
      // Found a parameter-like suffix
      const paramKey = regexMatch[1];
      const paramValue = regexMatch[2];

      // Add the full suffix to params to preserve info, e.g., "index_0"
      potentialParams.unshift(`${paramKey}_${paramValue}`);

      // Shorten the name by removing the matched suffix
      name = name.substring(0, regexMatch.index);
    }

    const allParams = [...parenParams, ...spaceParams, ...potentialParams];

    return { name, params: allParams };
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
  private detectParameterPatterns(recentActions: string[], semanticClusters: string[][]): number {
    if (recentActions.length < 3) return 0;

    const actionToParams = new Map<string, string[]>();
    recentActions.forEach((action) => {
      actionToParams.set(action, this.extractActionParameters(action).params);
    });

    let totalPatterns = 0;
    let totalComparisons = 0;

    // Look for parameter patterns within each semantic cluster
    for (const cluster of semanticClusters) {
      if (cluster.length < 2) continue;

      const paramsList = cluster.map((action) => actionToParams.get(action)!);

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
   * PERFORMANCE OPTIMIZED: Detect cyclical patterns using precomputed similarity matrix
   */
  private async detectCyclicalPatterns(
    actions: string[],
    similarityMatrix?: number[][]
  ): Promise<number> {
    if (actions.length < 4) return 0;

    // Use existing matrix or compute once if not provided
    const matrix = similarityMatrix || (await semanticAnalyzer.computeSimilarityMatrix(actions));
    let maxCyclicity = 0;

    // Check for cycles of length 2 to actions.length/2
    for (let cycleLen = 2; cycleLen <= Math.floor(actions.length / 2); cycleLen++) {
      let matches = 0;
      let comparisons = 0;

      for (let i = 0; i < actions.length - cycleLen; i++) {
        if (i + cycleLen < actions.length) {
          comparisons++;
          // Use precomputed similarity instead of individual model call
          if (matrix[i][i + cycleLen] > 0.7) {
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
   * PERFORMANCE OPTIMIZED: Detect oscillation patterns using precomputed similarity matrix
   */
  private async detectOscillationPatterns(
    actions: string[],
    similarityMatrix?: number[][]
  ): Promise<number> {
    if (actions.length < 4) return 0;

    // Use existing matrix or compute once if not provided
    const matrix = similarityMatrix || (await semanticAnalyzer.computeSimilarityMatrix(actions));
    let oscillations = 0;
    let checks = 0;

    for (let i = 0; i < actions.length - 3; i++) {
      checks++;
      // Use precomputed similarities instead of individual model calls
      const sim1 = matrix[i][i + 2];
      const sim2 = matrix[i + 1][i + 3];
      const sim3 = matrix[i][i + 1];

      if (sim1 > 0.7 && sim2 > 0.7 && sim3 < 0.7) {
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

  /**
   * Calculate the velocity of action changes (domain-agnostic pattern analysis)
   */
  private calculateActionChangeVelocity(actions: string[]): number {
    if (actions.length < 3) return 0.5;

    let changes = 0;
    for (let i = 1; i < actions.length; i++) {
      if (actions[i] !== actions[i - 1]) {
        changes++;
      }
    }

    return actions.length > 1 ? changes / (actions.length - 1) : 0;
  }

  /**
   * PERFORMANCE OPTIMIZED: Calculate semantic variation using fast embedding-based diversity
   */
  private async calculateSemanticVariation(
    actions: string[],
    similarityMatrix?: number[][]
  ): Promise<number> {
    if (actions.length < 4) return 0.5;

    // Use existing matrix or compute if not provided
    const matrix = similarityMatrix || (await semanticAnalyzer.computeSimilarityMatrix(actions));

    // Calculate diversity based on average pairwise similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < actions.length; i++) {
      for (let j = i + 1; j < actions.length; j++) {
        totalSimilarity += matrix[i][j];
        comparisons++;
      }
    }

    const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

    // High average similarity = low variation, low similarity = high variation
    const variation = 1 - avgSimilarity;

    // Calculate temporal evolution by comparing first and second half
    if (actions.length >= 8) {
      const midPoint = Math.floor(actions.length / 2);
      let firstHalfSim = 0;
      let secondHalfSim = 0;
      let firstHalfComps = 0;
      let secondHalfComps = 0;

      // Average similarity within first half
      for (let i = 0; i < midPoint; i++) {
        for (let j = i + 1; j < midPoint; j++) {
          firstHalfSim += matrix[i][j];
          firstHalfComps++;
        }
      }

      // Average similarity within second half
      for (let i = midPoint; i < actions.length; i++) {
        for (let j = i + 1; j < actions.length; j++) {
          secondHalfSim += matrix[i][j];
          secondHalfComps++;
        }
      }

      const firstAvg = firstHalfComps > 0 ? firstHalfSim / firstHalfComps : 0;
      const secondAvg = secondHalfComps > 0 ? secondHalfSim / secondHalfComps : 0;
      const evolution = Math.abs(firstAvg - secondAvg);

      return Math.max(0, Math.min(1, variation * 0.8 + evolution * 0.2));
    }

    return Math.max(0, Math.min(1, variation));
  }

  /**
   * PERFORMANCE OPTIMIZED: Check for progress indicators using batch processing
   */
  private async checkProgressIndicators(recentActions: string[]): Promise<boolean> {
    if (this.config.progress_indicators.length === 0) {
      return false;
    }

    // Batch compute similarities between all actions and all indicators
    const allTexts = [...recentActions, ...this.config.progress_indicators];
    const similarityMatrix = await semanticAnalyzer.computeSimilarityMatrix(allTexts);

    const actionCount = recentActions.length;

    // Check if any action is similar to any progress indicator
    for (let i = 0; i < actionCount; i++) {
      for (let j = actionCount; j < allTexts.length; j++) {
        if (similarityMatrix[i][j] > 0.7) {
          return true;
        }
      }
    }

    return false;
  }
}
