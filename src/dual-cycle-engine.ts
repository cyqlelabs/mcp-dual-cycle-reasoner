import { Sentinel } from './sentinel.js';
import { Adjudicator } from './adjudicator.js';
import { 
  CognitiveTrace, 
  LoopDetectionResult, 
  DiagnosisResult, 
  RecoveryPlan, 
  BeliefRevisionResult, 
  Case,
  SentinelConfig
} from './types.js';
import { v4 as uuidv4 } from 'uuid';
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
      recent_actions: [],
      current_context: undefined,
      goal: '',
      step_count: 0
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
   * Process a new cognitive trace update (called by the cognitive cycle)
   */
  processTraceUpdate(trace: CognitiveTrace): {
    intervention_required: boolean;
    loop_detected?: LoopDetectionResult;
    diagnosis?: DiagnosisResult;
    recovery_plan?: RecoveryPlan;
    revised_beliefs?: BeliefRevisionResult;
    explanation?: string;
  } {
    if (!this.isMonitoring) {
      return { intervention_required: false };
    }

    // Update current trace
    this.currentTrace = { ...this.currentTrace, ...trace };

    console.log(chalk.gray(`\n📊 Processing trace update: ${trace.recent_actions.length} actions, step ${trace.step_count}`));

    // METACOGNITIVE CYCLE - Phase 1: MONITOR
    const loopDetection = this.monitorForLoops(trace);

    if (!loopDetection.detected) {
      console.log(chalk.green('✅ No loops detected - cognitive cycle proceeding normally'));
      return { 
        intervention_required: false, 
        loop_detected: loopDetection 
      };
    }

    console.log(chalk.yellow(`⚠️  Loop detected: ${loopDetection.type} (confidence: ${(loopDetection.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.yellow(`   Details: ${loopDetection.details}`));

    // METACOGNITIVE CYCLE - Phase 2: INTERPRET/DETECT
    const diagnosis = this.interpretFailure(loopDetection, trace);
    console.log(chalk.red(`🔍 Diagnosis: ${diagnosis.primary_hypothesis} (confidence: ${(diagnosis.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.red(`   Evidence: ${diagnosis.evidence.join('; ')}`));

    // METACOGNITIVE CYCLE - Phase 3: PLAN (Meta-Level)
    const recoveryPlan = this.planRecovery(diagnosis, trace);
    console.log(chalk.blue(`🛠️  Recovery plan: ${recoveryPlan.pattern}`));
    console.log(chalk.blue(`   Rationale: ${recoveryPlan.rationale}`));

    // METACOGNITIVE CYCLE - Phase 4: CONTROL (Meta-Level)
    const beliefRevision = this.controlCognition(loopDetection, diagnosis, trace);
    console.log(chalk.magenta(`🧠 Beliefs revised: ${beliefRevision.revised_beliefs.length} beliefs, ${beliefRevision.removed_beliefs.length} removed`));

    // Store this experience for future learning
    this.storeExperience(loopDetection, diagnosis, recoveryPlan, trace);

    this.interventionCount++;

    const explanation = this.generateInterventionExplanation(
      loopDetection, 
      diagnosis, 
      recoveryPlan, 
      beliefRevision
    );

    console.log(chalk.cyan(`\n💡 Intervention #${this.interventionCount}: ${explanation}`));

    return {
      intervention_required: true,
      loop_detected: loopDetection,
      diagnosis,
      recovery_plan: recoveryPlan,
      revised_beliefs: beliefRevision,
      explanation
    };
  }

  /**
   * METACOGNITIVE CYCLE - Phase 1: MONITOR
   * Uses the Sentinel to detect problematic patterns
   */
  private monitorForLoops(trace: CognitiveTrace): LoopDetectionResult {
    return this.sentinel.detectLoop(trace, 'statistical');
  }

  /**
   * METACOGNITIVE CYCLE - Phase 2: INTERPRET/DETECT
   * Uses the Adjudicator to diagnose the failure
   */
  private interpretFailure(loopResult: LoopDetectionResult, trace: CognitiveTrace): DiagnosisResult {
    return this.adjudicator.diagnoseFailure(loopResult, trace);
  }

  /**
   * METACOGNITIVE CYCLE - Phase 3: PLAN (Meta-Level)
   * Uses the Adjudicator to generate a recovery plan
   */
  private planRecovery(diagnosis: DiagnosisResult, trace: CognitiveTrace): RecoveryPlan {
    return this.adjudicator.generateRecoveryPlan(diagnosis, trace);
  }

  /**
   * METACOGNITIVE CYCLE - Phase 4: CONTROL (Meta-Level)
   * Revises beliefs and prepares cognitive control signals
   */
  private controlCognition(
    loopResult: LoopDetectionResult, 
    diagnosis: DiagnosisResult, 
    trace: CognitiveTrace
  ): BeliefRevisionResult {
    const contradictingEvidence = `Loop detected: ${loopResult.type}. Diagnosis: ${diagnosis.primary_hypothesis}. Current strategy is ineffective.`;
    
    // For simplified traces, we'll use empty beliefs array as default
    const currentBeliefs: string[] = [];
    
    return this.adjudicator.reviseBeliefs(
      currentBeliefs, 
      contradictingEvidence, 
      trace
    );
  }

  /**
   * Store the experience for case-based reasoning
   */
  private storeExperience(
    loopResult: LoopDetectionResult,
    diagnosis: DiagnosisResult,
    recoveryPlan: RecoveryPlan,
    trace: CognitiveTrace
  ): void {
    const experience: Case = {
      id: uuidv4(),
      problem_description: `${loopResult.type} loop detected: ${diagnosis.primary_hypothesis} in context: ${this.extractContextSummary(trace)}`,
      solution: `Apply ${recoveryPlan.pattern} strategy: ${recoveryPlan.rationale}`,
      outcome: false, // Will be updated when outcome is known
      timestamp: Date.now()
    };

    this.adjudicator.storeExperience(experience);
  }

  /**
   * Generate a human-readable explanation of the intervention
   */
  private generateInterventionExplanation(
    loopResult: LoopDetectionResult,
    diagnosis: DiagnosisResult,
    recoveryPlan: RecoveryPlan,
    beliefRevision: BeliefRevisionResult
  ): string {
    const loopType = loopResult.type?.replace('_', ' ') || 'unknown';
    const hypothesis = diagnosis.primary_hypothesis.replace('_', ' ');
    const pattern = recoveryPlan.pattern.replace('_', ' ');
    
    return `Detected ${loopType} loop (${(loopResult.confidence * 100).toFixed(0)}% confidence). ` +
           `Diagnosed as ${hypothesis} issue. ` +
           `Applying ${pattern} recovery strategy. ` +
           `Revised ${beliefRevision.revised_beliefs.length} beliefs to maintain consistency.`;
  }

  /**
   * Extract a summary of the current context for case storage
   */
  private extractContextSummary(trace: CognitiveTrace): string {
    const recentActions = trace.recent_actions.slice(-3).join(' -> ');
    const currentContext = trace.current_context || 'unknown';
    
    return `Goal: ${trace.goal.substring(0, 50)}..., ` +
           `Recent actions: ${recentActions}, ` +
           `Context: ${currentContext}, ` +
           `Step: ${trace.step_count}`;
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
      trace_length: this.currentTrace.recent_actions.length
    };
  }

  /**
   * Update the outcome of a previously generated recovery plan
   */
  updateRecoveryOutcome(successful: boolean, explanation: string): void {
    // In a full implementation, this would update the most recent case
    // For now, we'll just log it
    console.log(chalk.cyan(`📝 Recovery outcome updated: ${successful ? 'SUCCESS' : 'FAILURE'} - ${explanation}`));
  }

  /**
   * Reset the engine state (useful for testing or new sessions)
   */
  reset(): void {
    this.sentinel.reset();
    this.currentTrace = this.initializeTrace();
    this.isMonitoring = false;
    this.interventionCount = 0;
    console.log(chalk.blue('🔄 Dual-Cycle Engine reset'));
  }

  /**
   * Get similar cases for analysis
   */
  getSimilarCases(problemDescription: string, maxResults: number = 5): Case[] {
    return this.adjudicator.retrieveSimilarCases(problemDescription, maxResults);
  }
}