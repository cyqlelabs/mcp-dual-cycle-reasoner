import {
  CognitiveTrace,
  LoopDetectionResult,
  DiagnosisResult,
  FailureHypothesis,
  BeliefRevisionResult,
  RecoveryPlan,
  RecoveryPattern,
  Case,
} from './types.js';

export class Adjudicator {
  private caseBase: Case[] = [];

  /**
   * Strategy 4: Belief Revision for Strategy Invalidation
   * Implements AGM belief revision principles to maintain logical consistency
   */
  reviseBeliefs(
    currentBeliefs: string[],
    contradictingEvidence: string,
    _trace: CognitiveTrace
  ): BeliefRevisionResult {
    const revisedBeliefs: string[] = [];
    const removedBeliefs: string[] = [];

    // For simplified approach, keep non-contradicted beliefs and add new insight
    for (const belief of currentBeliefs) {
      if (!this.doesEvidenceContradictBelief(belief, contradictingEvidence)) {
        revisedBeliefs.push(belief);
      } else {
        removedBeliefs.push(belief);
      }
    }

    // Add new belief based on evidence
    const newBelief = `Current strategy ineffective: ${contradictingEvidence}`;
    revisedBeliefs.push(newBelief);

    const rationale = `Removed ${removedBeliefs.length} contradicted beliefs and added insight about strategy failure`;

    return {
      revised_beliefs: revisedBeliefs,
      removed_beliefs: removedBeliefs,
      rationale,
    };
  }

  private doesEvidenceContradictBelief(belief: string, evidence: string): boolean {
    // Simple heuristic - check for contradictory keywords
    const beliefLower = belief.toLowerCase();
    const evidenceLower = evidence.toLowerCase();

    // If evidence mentions failure and belief is about success, they contradict
    if (
      evidenceLower.includes('ineffective') ||
      evidenceLower.includes('loop') ||
      evidenceLower.includes('failed')
    ) {
      return (
        beliefLower.includes('effective') ||
        beliefLower.includes('working') ||
        beliefLower.includes('successful')
      );
    }

    return false;
  }

  /**
   * Strategy 5: Abductive Reasoning for Failure Diagnosis
   * Generates and evaluates hypotheses to explain observed failures
   */
  diagnoseFailure(loopResult: LoopDetectionResult, trace: CognitiveTrace): DiagnosisResult {
    const hypotheses = this.generateFailureHypotheses(loopResult, trace);
    const evaluatedHypotheses = hypotheses.map((hypothesis) => ({
      hypothesis,
      evidence: this.gatherEvidence(hypothesis, trace),
      confidence: this.calculateHypothesisConfidence(hypothesis, trace),
    }));

    // Sort by confidence
    evaluatedHypotheses.sort((a, b) => b.confidence - a.confidence);
    const bestHypothesis = evaluatedHypotheses[0];

    const suggestedActions = this.generateDiagnosticActions(bestHypothesis.hypothesis, trace);

    return {
      primary_hypothesis: bestHypothesis.hypothesis,
      confidence: bestHypothesis.confidence,
      evidence: bestHypothesis.evidence,
      suggested_actions: suggestedActions,
    };
  }

  /**
   * Strategy 6: Case-Based Reasoning for Recovery
   * Retrieves and adapts solutions from similar past problems
   */
  generateRecoveryPlan(
    diagnosis: DiagnosisResult,
    trace: CognitiveTrace,
    availablePatterns?: RecoveryPattern[]
  ): RecoveryPlan {
    // First, try to retrieve similar cases
    const similarCases = this.retrieveSimilarCases(
      `${this.mapDiagnosisToLoopType(diagnosis)}: ${diagnosis.primary_hypothesis} in ${this.extractContext(trace)}`
    );

    if (similarCases.length > 0 && similarCases[0].outcome) {
      // Create a plan based on the successful case
      return {
        pattern: 'strategic_retreat' as RecoveryPattern,
        actions: [similarCases[0].solution],
        rationale: `Adapted from similar successful case`,
        expected_outcome: 'Recovery based on proven solution',
      };
    }

    // If no successful cases found, generate new plan
    return this.generateNovelRecoveryPlan(diagnosis, trace, availablePatterns);
  }

  /**
   * Store experience for future case-based reasoning
   */
  storeExperience(case_: Case): void {
    this.caseBase.push(case_);

    // Limit case base size to prevent memory issues
    if (this.caseBase.length > 1000) {
      // Remove oldest cases with low success rate
      this.caseBase = this.caseBase
        .sort((a, b) => {
          if (a.outcome !== b.outcome) {
            return b.outcome ? 1 : -1;
          }
          return (b.timestamp || 0) - (a.timestamp || 0);
        })
        .slice(0, 800);
    }
  }

  /**
   * Retrieve similar cases for CBR
   */
  retrieveSimilarCases(problemDescription: string, maxResults: number = 5): Case[] {
    const scoredCases = this.caseBase.map((case_) => ({
      case: case_,
      similarity: this.calculateCaseSimilarity(problemDescription, case_.problem_description),
    }));

    return scoredCases
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
      .map((item) => item.case);
  }

  private generateFailureHypotheses(
    loopResult: LoopDetectionResult,
    _trace: CognitiveTrace
  ): FailureHypothesis[] {
    const hypotheses: FailureHypothesis[] = [];

    if (loopResult.type === 'action_repetition') {
      hypotheses.push('element_state_error', 'selector_error');
    }

    if (loopResult.type === 'state_invariance') {
      hypotheses.push('page_state_error', 'network_error');
    }

    if (loopResult.type === 'progress_stagnation') {
      hypotheses.push('task_model_error', 'element_state_error');
    }

    // Always consider these as backup hypotheses
    hypotheses.push('unknown');

    return [...new Set(hypotheses)]; // Remove duplicates
  }

  private gatherEvidence(hypothesis: FailureHypothesis, trace: CognitiveTrace): string[] {
    const evidence: string[] = [];
    const recentActions = trace.recent_actions.slice(-5);

    switch (hypothesis) {
      case 'element_state_error':
        if (recentActions.some((a) => a.includes('element not found'))) {
          evidence.push('Element not found errors in recent actions');
        }
        if (recentActions.some((a) => a.includes('not clickable'))) {
          evidence.push('Element not clickable errors detected');
        }
        break;

      case 'page_state_error':
        if (trace.recent_actions.length > 1) {
          const recentContext = trace.current_context || '';
          if (recentContext === '') {
            evidence.push('Page state has not changed despite actions');
          }
        }
        break;

      case 'selector_error':
        const selectorActions = recentActions.filter(
          (a) => a.includes('selector') && a.includes('error')
        );
        if (selectorActions.length > 0) {
          evidence.push(`${selectorActions.length} actions with selector errors`);
        }
        break;

      case 'task_model_error':
        if (trace.step_count > 5) {
          const hasProgress = trace.recent_actions.length > 0;
          if (!hasProgress) {
            evidence.push('No progress suggests incorrect task understanding');
          }
        }
        break;

      case 'network_error':
        if (recentActions.some((a) => a.includes('network') || a.includes('timeout'))) {
          evidence.push('Network or timeout errors detected');
        }
        break;
    }

    return evidence;
  }

  private calculateHypothesisConfidence(
    hypothesis: FailureHypothesis,
    trace: CognitiveTrace
  ): number {
    const evidence = this.gatherEvidence(hypothesis, trace);
    const baseConfidence = 0.4;
    const evidenceBonus = evidence.length * 0.15;

    return Math.min(0.95, baseConfidence + evidenceBonus);
  }

  private generateDiagnosticActions(
    hypothesis: FailureHypothesis,
    _trace: CognitiveTrace
  ): string[] {
    switch (hypothesis) {
      case 'element_state_error':
        return [
          'Check element visibility and enabled state',
          'Verify element is not obscured by overlays',
          'Wait for element to become interactive',
        ];

      case 'page_state_error':
        return [
          'Refresh the page',
          'Wait for pending network requests',
          'Check for JavaScript errors',
        ];

      case 'selector_error':
        return [
          'Try alternative selectors for the same element',
          'Use xpath or CSS selector alternatives',
          'Switch to visual element identification',
        ];

      case 'task_model_error':
        return [
          'Re-examine the current goal and sub-goals',
          'Gather more information about page structure',
          'Consider alternative task decomposition',
        ];

      case 'network_error':
        return ['Retry the last action', 'Check network connectivity', 'Increase timeout values'];

      default:
        return [
          'Gather more diagnostic information',
          'Try a different approach',
          'Consider human escalation',
        ];
    }
  }

  private mapDiagnosisToLoopType(diagnosis: DiagnosisResult): any {
    // Map diagnosis back to loop type for case retrieval
    switch (diagnosis.primary_hypothesis) {
      case 'element_state_error':
      case 'selector_error':
        return 'action_repetition';
      case 'page_state_error':
      case 'network_error':
        return 'state_invariance';
      case 'task_model_error':
        return 'progress_stagnation';
      default:
        return 'action_repetition';
    }
  }

  private extractContext(trace: CognitiveTrace): string {
    const recentActions = trace.recent_actions.slice(-3).join(' -> ');
    const currentContext = trace.current_context || 'unknown';
    return `Actions: ${recentActions}, Context: ${currentContext}, Goal: ${trace.goal}`;
  }

  private generateNovelRecoveryPlan(
    diagnosis: DiagnosisResult,
    trace: CognitiveTrace,
    availablePatterns?: RecoveryPattern[]
  ): RecoveryPlan {
    const patterns = availablePatterns || [
      'strategic_retreat',
      'context_refresh',
      'modality_switching',
    ];
    const selectedPattern = this.selectRecoveryPattern(diagnosis, patterns);

    return {
      pattern: selectedPattern,
      actions: this.generateActionsForPattern(selectedPattern, diagnosis, trace),
      rationale: `Novel recovery plan for ${diagnosis.primary_hypothesis} with confidence ${diagnosis.confidence}`,
      expected_outcome: 'Break current loop and resume progress toward goal',
    };
  }

  private selectRecoveryPattern(
    diagnosis: DiagnosisResult,
    availablePatterns: RecoveryPattern[]
  ): RecoveryPattern {
    switch (diagnosis.primary_hypothesis) {
      case 'page_state_error':
      case 'network_error':
        return availablePatterns.includes('context_refresh')
          ? 'context_refresh'
          : availablePatterns[0];
      case 'selector_error':
      case 'element_state_error':
        return availablePatterns.includes('modality_switching')
          ? 'modality_switching'
          : availablePatterns[0];
      case 'task_model_error':
        return availablePatterns.includes('information_foraging')
          ? 'information_foraging'
          : availablePatterns[0];
      default:
        return availablePatterns.includes('strategic_retreat')
          ? 'strategic_retreat'
          : availablePatterns[0];
    }
  }

  private generateActionsForPattern(
    pattern: RecoveryPattern,
    _diagnosis: DiagnosisResult,
    _trace: CognitiveTrace
  ): string[] {
    switch (pattern) {
      case 'strategic_retreat':
        return [
          'Undo last 2-3 actions',
          'Return to known good state',
          'Try alternative approach to current sub-goal',
        ];

      case 'context_refresh':
        return [
          'Refresh page',
          'Clear browser cache',
          'Restart from current goal with fresh state',
        ];

      case 'modality_switching':
        return [
          'Take screenshot of current page',
          'Use visual element detection',
          'Click element by coordinates instead of selector',
        ];

      case 'information_foraging':
        return [
          'Explore page structure systematically',
          'Document available interactive elements',
          'Build updated mental model of page',
        ];

      case 'human_escalation':
        return [
          'Pause autonomous execution',
          'Request human guidance',
          'Provide detailed context about failure',
        ];

      default:
        return ['Try generic recovery approach'];
    }
  }

  private calculateCaseSimilarity(current: string, stored: string): number {
    // Simple string similarity using common tokens
    const currentTokens = current.toLowerCase().split(/\s+/);
    const storedTokens = stored.toLowerCase().split(/\s+/);
    const commonTokens = currentTokens.filter((token) => storedTokens.includes(token));
    const similarity = commonTokens.length / Math.max(currentTokens.length, storedTokens.length);

    return similarity;
  }
}

