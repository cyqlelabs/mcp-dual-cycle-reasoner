import {
  CognitiveTrace,
  LoopDetectionResult,
  DiagnosisResult,
  FailureHypothesis,
  RecoveryPlan,
  RecoveryPattern,
  Case,
} from './types.js';
import natural from 'natural';
import nlp from 'compromise';
import { semanticAnalyzer } from './semantic-analyzer.js';

// Extract needed components from natural
const { SentimentAnalyzer, PorterStemmer, WordTokenizer } = natural;

export class Adjudicator {
  private caseBase: Case[] = [];

  /**
   * Strategy 5: Abductive Reasoning for Failure Diagnosis
   * Generates and evaluates hypotheses to explain observed failures
   */
  async diagnoseFailure(
    loopResult: LoopDetectionResult,
    trace: CognitiveTrace & { recent_actions: string[] }
  ): Promise<DiagnosisResult> {
    const hypotheses = this.generateFailureHypotheses(loopResult, trace);
    const evaluatedHypotheses = await Promise.all(
      hypotheses.map(async (hypothesis) => ({
        hypothesis,
        evidence: await this.gatherEvidence(hypothesis, trace),
        confidence: await this.calculateHypothesisConfidence(hypothesis, trace),
      }))
    );

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
    trace: CognitiveTrace & { recent_actions: string[] },
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
    _trace: CognitiveTrace & { recent_actions: string[] }
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

  private async gatherEvidence(
    hypothesis: FailureHypothesis,
    trace: CognitiveTrace & { recent_actions: string[] }
  ): Promise<string[]> {
    const evidence: string[] = [];
    const recentActions = trace.recent_actions ? trace.recent_actions.slice(-5) : [];

    // Define expected outcomes for each hypothesis type
    const expectedOutcomes: Record<FailureHypothesis, string> = {
      element_state_error: 'Elements can be found and interacted with successfully',
      page_state_error: 'Page state changes appropriately after actions',
      selector_error: 'Selectors work correctly without errors',
      task_model_error: 'Task progresses efficiently toward completion',
      network_error: 'Network operations complete without timeout or connection issues',
      unknown: 'Actions execute successfully without errors',
    };

    const expectedOutcome = expectedOutcomes[hypothesis];

    // Use semantic analysis to assess each recent action
    for (const action of recentActions) {
      try {
        const assessment = await semanticAnalyzer.assessActionOutcome(action, expectedOutcome);

        if (assessment.category === 'failure' && assessment.confidence > 0.7) {
          evidence.push(`Action "${action}" contradicts expected outcome: ${assessment.reasoning}`);
        } else if (assessment.category === 'neutral' && assessment.confidence > 0.8) {
          evidence.push(`Action "${action}" shows unclear outcome: ${assessment.reasoning}`);
        }
      } catch (error) {
        console.error('Error assessing action outcome:', error);
      }
    }

    // Additional hypothesis-specific semantic checks
    switch (hypothesis) {
      case 'page_state_error':
        if (trace.recent_actions.length > 1) {
          const recentContext = trace.current_context || '';
          if (recentContext === '') {
            evidence.push('Page state has not changed despite actions');
          }
        }
        break;

      case 'task_model_error':
        if (trace.recent_actions.length > 5) {
          const hasProgress = trace.recent_actions.length > 0;
          if (!hasProgress) {
            evidence.push('No progress suggests incorrect task understanding');
          }
        }
        break;
    }

    return evidence;
  }

  private async calculateHypothesisConfidence(
    hypothesis: FailureHypothesis,
    trace: CognitiveTrace & { recent_actions: string[] }
  ): Promise<number> {
    const evidence = await this.gatherEvidence(hypothesis, trace);
    const baseConfidence = 0.4;
    const evidenceBonus = evidence.length * 0.15;

    return Math.min(0.95, baseConfidence + evidenceBonus);
  }

  private generateDiagnosticActions(
    hypothesis: FailureHypothesis,
    _trace: CognitiveTrace & { recent_actions: string[] }
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

  private extractContext(trace: CognitiveTrace & { recent_actions: string[] }): string {
    const recentActions = trace.recent_actions.slice(-3).join(' -> ');
    const currentContext = trace.current_context || 'unknown';
    return `Actions: ${recentActions}, Context: ${currentContext}, Goal: ${trace.goal}`;
  }

  private generateNovelRecoveryPlan(
    diagnosis: DiagnosisResult,
    trace: CognitiveTrace & { recent_actions: string[] },
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
    _trace: CognitiveTrace & { recent_actions: string[] }
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

  /**
   * Enhanced semantic similarity calculation using multiple NLP techniques
   */
  private calculateCaseSimilarity(current: string, stored: string): number {
    // Parse both texts with compromise
    const currentDoc = nlp(current);
    const storedDoc = nlp(stored);

    // Extract and stem key terms
    const currentTerms = currentDoc
      .terms()
      .out('array')
      .map((term: string) => PorterStemmer.stem(term.toLowerCase()))
      .filter((term: string) => term.length > 2);
    const storedTerms = storedDoc
      .terms()
      .out('array')
      .map((term: string) => PorterStemmer.stem(term.toLowerCase()))
      .filter((term: string) => term.length > 2);

    // Calculate Jaccard similarity for stemmed terms
    const jaccardSimilarity = this.calculateJaccardDistance(currentTerms, storedTerms);
    const jaccardScore = 1 - jaccardSimilarity;

    // Calculate sentiment similarity using natural library
    const tokenizer = new WordTokenizer();
    const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');

    const currentTokens = tokenizer.tokenize(current) || [];
    const storedTokens = tokenizer.tokenize(stored) || [];

    const currentSentiment = analyzer.getSentiment(currentTokens);
    const storedSentiment = analyzer.getSentiment(storedTokens);
    const sentimentSimilarity = 1 - Math.abs(currentSentiment - storedSentiment);

    // Calculate TF-IDF based similarity for better semantic matching
    const allTerms = [...new Set([...currentTerms, ...storedTerms])];
    const currentVector = this.createTfIdfVector(currentTerms, allTerms);
    const storedVector = this.createTfIdfVector(storedTerms, allTerms);
    const cosineSimilarity = this.calculateCosineSimilarity(currentVector, storedVector);

    // Combine multiple similarity measures
    const combinedSimilarity =
      jaccardScore * 0.4 + sentimentSimilarity * 0.3 + cosineSimilarity * 0.3;

    return Math.max(0, Math.min(1, combinedSimilarity));
  }

  /**
   * Create TF-IDF vector for semantic similarity
   */
  private createTfIdfVector(terms: string[], allTerms: string[]): number[] {
    const termFreq = terms.reduce(
      (freq, term) => {
        freq[term] = (freq[term] || 0) + 1;
        return freq;
      },
      {} as Record<string, number>
    );

    return allTerms.map((term) => {
      const tf = (termFreq[term] || 0) / terms.length;
      // Simplified IDF calculation
      const idf = Math.log(1 + 1 / Math.max(1, termFreq[term] || 0));
      return tf * idf;
    });
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Enhanced evidence gathering using semantic analysis
   */

  /**
   * Calculate Jaccard distance between two string arrays
   */
  private calculateJaccardDistance(set1: string[], set2: string[]): number {
    const s1 = new Set(set1);
    const s2 = new Set(set2);

    const intersection = new Set([...s1].filter((x) => s2.has(x)));
    const union = new Set([...s1, ...s2]);

    if (union.size === 0) return 0;

    const jaccardSimilarity = intersection.size / union.size;
    return 1 - jaccardSimilarity; // Return distance (1 - similarity)
  }
}
