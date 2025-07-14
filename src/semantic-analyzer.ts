import { pipeline, ZeroShotClassificationPipeline } from '@huggingface/transformers';

export interface SemanticAnalysisResult {
  label: 'CONTRADICTION' | 'ENTAILMENT' | 'NEUTRAL';
  score: number;
  confidence: number;
}

export interface BeliefContradictionResult {
  contradicts: boolean;
  confidence: number;
  reasoning: string;
}

export interface ActionAssessmentResult {
  category: 'success' | 'failure' | 'neutral';
  confidence: number;
  reasoning: string;
}

export class SemanticAnalyzer {
  private nliClassifier: ZeroShotClassificationPipeline | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing NLI model...');
    try {
      this.nliClassifier = await pipeline<'zero-shot-classification'>(
        'zero-shot-classification',
        'MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33',
        { cache_dir: process.env.HF_HUB_CACHE }
      );
      this.isInitialized = true;
      console.log('NLI model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NLI model:', error);
      throw error;
    }
  }

  async analyzeTextPair(premise: string, hypothesis: string): Promise<SemanticAnalysisResult> {
    if (!this.isInitialized || !this.nliClassifier) {
      throw new Error('SemanticAnalyzer not initialized. Call initialize() first.');
    }

    try {
      const labels = ['CONTRADICTION', 'ENTAILMENT', 'NEUTRAL'];
      const result = await this.nliClassifier(premise, labels, {
        hypothesis_template: '{}',
      });

      const output = Array.isArray(result) ? result[0] : result;
      const topLabel = output.labels[0];
      const topScore = output.scores[0];

      return {
        label: topLabel as 'CONTRADICTION' | 'ENTAILMENT' | 'NEUTRAL',
        score: topScore,
        confidence: topScore,
      };
    } catch (error) {
      console.error('Error analyzing text pair:', error);
      throw error;
    }
  }

  async assessBeliefContradiction(
    belief: string,
    evidence: string
  ): Promise<BeliefContradictionResult> {
    const analysis = await this.analyzeTextPair(belief, evidence);

    const contradicts = analysis.label === 'CONTRADICTION' && analysis.confidence > 0.7;

    return {
      contradicts,
      confidence: analysis.confidence,
      reasoning: `NLI analysis: ${analysis.label} (confidence: ${analysis.confidence.toFixed(3)})`,
    };
  }

  async assessActionOutcome(
    action: string,
    expectedOutcome: string
  ): Promise<ActionAssessmentResult> {
    const analysis = await this.analyzeTextPair(action, expectedOutcome);

    let category: 'success' | 'failure' | 'neutral';
    let reasoning: string;

    if (analysis.label === 'ENTAILMENT' && analysis.confidence > 0.7) {
      category = 'success';
      reasoning = `Action aligns with expected outcome (${analysis.confidence.toFixed(3)})`;
    } else if (analysis.label === 'CONTRADICTION' && analysis.confidence > 0.7) {
      category = 'failure';
      reasoning = `Action contradicts expected outcome (${analysis.confidence.toFixed(3)})`;
    } else {
      category = 'neutral';
      reasoning = `Uncertain relationship: ${analysis.label} (${analysis.confidence.toFixed(3)})`;
    }

    return {
      category,
      confidence: analysis.confidence,
      reasoning,
    };
  }

  async detectContradictionsInActions(actions: string[]): Promise<
    Array<{
      action1: string;
      action2: string;
      contradicts: boolean;
      confidence: number;
    }>
  > {
    const contradictions = [];

    for (let i = 0; i < actions.length; i++) {
      for (let j = i + 1; j < actions.length; j++) {
        const analysis = await this.analyzeTextPair(actions[i], actions[j]);

        if (analysis.label === 'CONTRADICTION' && analysis.confidence > 0.6) {
          contradictions.push({
            action1: actions[i],
            action2: actions[j],
            contradicts: true,
            confidence: analysis.confidence,
          });
        }
      }
    }

    return contradictions;
  }

  async analyzeBeliefConsistency(beliefs: string[]): Promise<
    Array<{
      belief1: string;
      belief2: string;
      relationship: 'contradiction' | 'entailment' | 'neutral';
      confidence: number;
    }>
  > {
    const relationships = [];

    for (let i = 0; i < beliefs.length; i++) {
      for (let j = i + 1; j < beliefs.length; j++) {
        const analysis = await this.analyzeTextPair(beliefs[i], beliefs[j]);

        relationships.push({
          belief1: beliefs[i],
          belief2: beliefs[j],
          relationship: analysis.label.toLowerCase() as 'contradiction' | 'entailment' | 'neutral',
          confidence: analysis.confidence,
        });
      }
    }

    return relationships;
  }

  async classifyActionIntent(
    action: string,
    possibleIntents: string[]
  ): Promise<{
    bestMatch: string;
    confidence: number;
    allScores: Array<{ intent: string; score: number }>;
  }> {
    const scores = [];

    for (const intent of possibleIntents) {
      const analysis = await this.analyzeTextPair(action, intent);
      scores.push({
        intent,
        score:
          analysis.label === 'ENTAILMENT'
            ? analysis.confidence
            : analysis.label === 'NEUTRAL'
              ? analysis.confidence * 0.5
              : analysis.confidence * 0.1,
      });
    }

    scores.sort((a, b) => b.score - a.score);

    return {
      bestMatch: scores[0].intent,
      confidence: scores[0].score,
      allScores: scores,
    };
  }

  isReady(): boolean {
    return this.isInitialized && this.nliClassifier !== null;
  }
}

export const semanticAnalyzer = new SemanticAnalyzer();
