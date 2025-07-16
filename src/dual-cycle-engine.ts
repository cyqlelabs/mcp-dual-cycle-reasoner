import { Sentinel } from './sentinel.js';
import { Adjudicator } from './adjudicator.js';
import { CognitiveTrace, LoopDetectionResult, Case, SentinelConfig } from './types.js';
import chalk from 'chalk';

/**
 * The Dual-Cycle Engine implements the metacognitive framework described in the DUAL-CYCLE document.
 * It consists of two interconnected cycles:
 * - Cognitive Cycle (The "Doer"): Direct interaction with the environment
 * - Metacognitive Cycle (The "Thinker"): Monitors and controls the cognitive cycle
 */
export class DualCycleEngine {
  private sentinel: Sentinel;
  private adjudicator: Adjudicator;
  private currentTrace: CognitiveTrace;
  private isMonitoring: boolean = false;
  private interventionCount: number = 0;
  private accumulatedActions: string[] = [];

  constructor(config?: Partial<SentinelConfig>) {
    this.sentinel = new Sentinel(config);
    this.adjudicator = new Adjudicator();
    this.currentTrace = this.initializeTrace();
  }

  /**
   * Initialize a new cognitive trace for monitoring
   */
  private initializeTrace(): CognitiveTrace {
    return {
      last_action: '',
      current_context: undefined,
      goal: '',
    };
  }

  /**
   * Start metacognitive monitoring of an agent's cognitive trace
   */
  startMonitoring(initialGoal: string, initialBeliefs: string[] = []): void {
    this.isMonitoring = true;
    this.currentTrace = this.initializeTrace();
    this.currentTrace.goal = initialGoal;
    this.interventionCount = 0;
    this.accumulatedActions = [];

    console.log(chalk.blue('🧠 Dual-Cycle Engine: Metacognitive monitoring started'));
    console.log(chalk.gray(`Goal: ${initialGoal}`));
    console.log(chalk.gray(`Initial beliefs: ${initialBeliefs.length}`));
  }

  /**
   * Stop metacognitive monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log(chalk.blue('🧠 Dual-Cycle Engine: Monitoring stopped'));
    console.log(chalk.gray(`Total interventions: ${this.interventionCount}`));
  }

  /**
   * Process a new cognitive trace update with a single action (called by the cognitive cycle)
   */
  async processTraceUpdate(
    lastAction: string,
    currentContext?: string,
    goal?: string,
    windowSize?: number
  ): Promise<{
    intervention_required: boolean;
    loop_detected?: LoopDetectionResult;
    explanation?: string;
  }> {
    if (!this.isMonitoring) {
      return { intervention_required: false };
    }

    // Add the new action to the accumulated actions
    this.accumulatedActions.push(lastAction);
    this.currentTrace.last_action = lastAction;

    console.log(
      `🔍 DEBUG: Added action "${lastAction}" to accumulated actions. Total: ${this.accumulatedActions.length}`
    );

    // Update other trace properties if provided
    if (currentContext) {
      this.currentTrace.current_context = currentContext;
    }
    if (goal) {
      this.currentTrace.goal = goal;
    }

    console.log(
      chalk.gray(
        `\n📊 Processing trace update: Added "${lastAction}" (${this.accumulatedActions.length} total actions)`
      )
    );

    // METACOGNITIVE CYCLE - Phase 1: MONITOR
    const loopDetection = this.monitorForLoops(this.currentTrace, windowSize ?? 10);

    if (!loopDetection.detected) {
      console.log(chalk.green('✅ No loops detected - cognitive cycle proceeding normally'));
      return {
        intervention_required: false,
        loop_detected: loopDetection,
      };
    }

    console.log(
      chalk.yellow(
        `⚠️  Loop detected: ${loopDetection.type} (confidence: ${(loopDetection.confidence * 100).toFixed(1)}%)`
      )
    );
    console.log(chalk.yellow(`   Details: ${loopDetection.details}`));

    this.interventionCount++;

    const explanation = this.generateInterventionExplanation(loopDetection);

    console.log(chalk.cyan(`\n💡 Intervention #${this.interventionCount}: ${explanation}`));

    return {
      intervention_required: true,
      loop_detected: loopDetection,
      explanation,
    };
  }

  /**
   * Get current trace for standalone loop detection
   */
  getCurrentTrace(): CognitiveTrace {
    return this.currentTrace;
  }

  /**
   * Get enriched trace with accumulated actions for internal use
   */
  private getEnrichedTrace(): CognitiveTrace & { recent_actions: string[] } {
    return {
      ...this.currentTrace,
      recent_actions: this.accumulatedActions || [],
    };
  }

  /**
   * Get enriched trace with accumulated actions (public method for standalone tools)
   */
  getEnrichedCurrentTrace(): CognitiveTrace & { recent_actions: string[] } {
    return {
      ...this.currentTrace,
      recent_actions: this.accumulatedActions || [],
    };
  }

  /**
   * METACOGNITIVE CYCLE - Phase 1: MONITOR
   * Uses the Sentinel to detect problematic patterns
   */
  private monitorForLoops(trace: CognitiveTrace, windowSize: number = 10): LoopDetectionResult {
    const enrichedTrace = this.getEnrichedTrace();
    return this.sentinel.detectLoop(enrichedTrace, 'hybrid', windowSize);
  }

  /**
   * Generate a human-readable explanation of the intervention
   */
  private generateInterventionExplanation(loopResult: LoopDetectionResult): string {
    const loopType = loopResult.type?.replace('_', ' ') || 'unknown';

    return (
      `Detected ${loopType} loop (${(loopResult.confidence * 100).toFixed(0)}% confidence). ` +
      `Intervention required to break the loop.`
    );
  }

  /**
   * Extract a summary of the current context for case storage
   */
  private extractContextSummary(trace: CognitiveTrace): string {
    const recentActions = this.accumulatedActions.slice(-3).join(' -> ');
    const currentContext = trace.current_context || 'unknown';

    return (
      `Goal: ${trace.goal.substring(0, 50)}..., ` +
      `Recent actions: ${recentActions}, ` +
      `Context: ${currentContext}`
    );
  }

  /**
   * Get current monitoring status and statistics
   */
  getMonitoringStatus(): {
    is_monitoring: boolean;
    intervention_count: number;
    current_goal: string;
    trace_length: number;
  } {
    return {
      is_monitoring: this.isMonitoring,
      intervention_count: this.interventionCount,
      current_goal: this.currentTrace.goal,
      trace_length: this.accumulatedActions.length,
    };
  }


  /**
   * Reset the engine state (useful for testing or new sessions)
   */
  reset(): void {
    this.sentinel.reset();
    this.currentTrace = this.initializeTrace();
    this.isMonitoring = false;
    this.interventionCount = 0;
    this.accumulatedActions = [];
    console.log(chalk.blue('🔄 Dual-Cycle Engine reset'));
  }

  /**
   * Get similar cases for analysis
   */
  getSimilarCases(problemDescription: string, maxResults: number = 5): Case[] {
    return this.adjudicator.retrieveSimilarCases(problemDescription, maxResults);
  }
}
