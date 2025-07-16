import { pipeline, ZeroShotClassificationPipeline } from '@huggingface/transformers';

export interface SemanticAnalysisResult {
  label: 'CONTRADICTION' | 'ENTAILMENT' | 'NEUTRAL';
  score: number;
  confidence: number;
}

export interface ActionAssessmentResult {
  category: 'success' | 'failure' | 'neutral';
  confidence: number;
  reasoning: string;
}

export interface SemanticSimilarityResult {
  similarity: number;
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
        hypothesis_template: `${hypothesis}`,
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

  /**
   * Calculate semantic similarity between two texts using NLI-based approach
   * Higher similarity indicates more related content
   */
  async calculateSemanticSimilarity(
    text1: string,
    text2: string
  ): Promise<SemanticSimilarityResult> {
    if (!this.isInitialized || !this.nliClassifier) {
      throw new Error('SemanticAnalyzer not initialized. Call initialize() first.');
    }

    try {
      // Analyze both directions for better similarity assessment
      const analysis1 = await this.analyzeTextPair(text1, text2);
      const analysis2 = await this.analyzeTextPair(text2, text1);

      // Calculate similarity based on entailment and neutral scores
      let similarity = 0;
      let reasoning = '';

      if (analysis1.label === 'ENTAILMENT' && analysis2.label === 'ENTAILMENT') {
        // High bidirectional entailment indicates strong similarity
        similarity = Math.max(analysis1.confidence, analysis2.confidence);
        reasoning = 'Strong bidirectional semantic relationship';
      } else if (analysis1.label === 'ENTAILMENT' || analysis2.label === 'ENTAILMENT') {
        // Unidirectional entailment indicates moderate similarity
        similarity = Math.max(analysis1.confidence, analysis2.confidence) * 0.8;
        reasoning = 'Unidirectional semantic relationship';
      } else if (analysis1.label === 'NEUTRAL' && analysis2.label === 'NEUTRAL') {
        // Both neutral - moderate similarity based on confidence
        similarity = ((analysis1.confidence + analysis2.confidence) / 2) * 0.6;
        reasoning = 'Neutral semantic relationship with potential overlap';
      } else if (analysis1.label === 'CONTRADICTION' || analysis2.label === 'CONTRADICTION') {
        // Contradiction indicates low similarity
        similarity = Math.min(analysis1.confidence, analysis2.confidence) * 0.2;
        reasoning = 'Contradictory semantic relationship';
      } else {
        // Mixed results - moderate similarity
        similarity = ((analysis1.confidence + analysis2.confidence) / 2) * 0.5;
        reasoning = 'Mixed semantic relationship';
      }

      const overallConfidence = (analysis1.confidence + analysis2.confidence) / 2;

      return {
        similarity: Math.max(0, Math.min(1, similarity)),
        confidence: overallConfidence,
        reasoning,
      };
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      throw error;
    }
  }

  /**
   * Extract semantic features from text for advanced similarity calculations
   */
  async extractSemanticFeatures(
    text: string,
    customIntents?: string[]
  ): Promise<{
    intents: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }> {
    if (!this.isInitialized || !this.nliClassifier) {
      throw new Error('SemanticAnalyzer not initialized. Call initialize() first.');
    }

    try {
      // Use custom intents if provided, otherwise use generic ones
      const intents = customIntents || [
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
      ];

      const intentAnalysis = await this.classifyActionIntent(text, intents);

      // Sentiment analysis using predefined labels
      const sentimentLabels = ['positive outcome', 'negative outcome', 'neutral outcome'];
      const sentimentResult = await this.nliClassifier(text, sentimentLabels);
      const sentimentOutput = Array.isArray(sentimentResult) ? sentimentResult[0] : sentimentResult;

      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (sentimentOutput.labels[0] === 'positive outcome') {
        sentiment = 'positive';
      } else if (sentimentOutput.labels[0] === 'negative outcome') {
        sentiment = 'negative';
      }

      return {
        intents: [intentAnalysis.bestMatch],
        sentiment,
        confidence: Math.min(intentAnalysis.confidence, sentimentOutput.scores[0]),
      };
    } catch (error) {
      console.error('Error extracting semantic features:', error);
      return {
        intents: [],
        sentiment: 'neutral',
        confidence: 0,
      };
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.nliClassifier !== null;
  }
}

export const semanticAnalyzer = new SemanticAnalyzer();
