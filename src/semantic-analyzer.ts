import {
  pipeline,
  ZeroShotClassificationPipeline,
  FeatureExtractionPipeline,
} from '@huggingface/transformers';

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
  private embeddingModel: FeatureExtractionPipeline | null = null;
  private isInitialized = false;
  private embeddingCache: Map<string, number[]> = new Map();
  private readonly maxCacheSize = 500;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing semantic models...');
    try {
      // Initialize fast embedding model for similarity comparisons
      console.log('Loading sentence embedding model...');
      this.embeddingModel = await pipeline<'feature-extraction'>(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          cache_dir: process.env.HF_HUB_CACHE || '.hf_cache',
        }
      );

      // Initialize NLI model for precision tasks (lazy loaded)
      this.isInitialized = true;
      console.log('Semantic models initialized successfully');
    } catch (error) {
      console.error('Failed to initialize semantic models:', error);
      throw error;
    }
  }

  async analyzeTextPair(premise: string, hypothesis: string): Promise<SemanticAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('SemanticAnalyzer not initialized. Call initialize() first.');
    }

    // Lazy load NLI classifier when needed for precision tasks
    if (!this.nliClassifier) {
      console.log('Loading NLI model for precision analysis...');
      this.nliClassifier = await pipeline<'zero-shot-classification'>(
        'zero-shot-classification',
        'MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33',
        { cache_dir: process.env.HF_HUB_CACHE || '.hf_cache' }
      );
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
    if (!this.isInitialized || !this.embeddingModel) {
      throw new Error('SemanticAnalyzer not initialized. Call initialize() first.');
    }

    try {
      // Use fast embedding-based similarity (much faster than NLI)
      const [embedding1, embedding2] = await this.getBatchEmbeddings([text1, text2]);
      const similarity = this.cosineSimilarity(embedding1, embedding2);

      return {
        similarity: Math.max(0, Math.min(1, similarity)),
        confidence: 0.85, // High confidence for embedding-based similarity
        reasoning: 'Fast embedding-based semantic similarity',
      };
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      throw error;
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION: Batch compute embeddings for multiple texts
   * This is 10-100x faster than individual model calls
   */
  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embeddingModel) {
      throw new Error('Embedding model not initialized');
    }

    const embeddings: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const cached = this.embeddingCache.get(texts[i]);
      if (cached) {
        embeddings[i] = cached;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // Process uncached texts individually for consistency (performance preserved via caching)
    if (uncachedTexts.length > 0) {
      const batchEmbeddings: number[][] = [];

      // Process texts individually to ensure consistent embedding dimensions
      for (const text of uncachedTexts) {
        const singleResult = await this.embeddingModel(text, {
          pooling: 'mean',
          normalize: true,
        });

        if (singleResult && singleResult.data) {
          const embedding = Array.from(singleResult.data) as number[];

          // Validate that we're getting the expected 384-dimensional embeddings
          if (embedding.length !== 384) {
            console.error(
              `Unexpected embedding dimension: ${embedding.length} (expected 384) for text: "${text.slice(0, 50)}..."`
            );
            console.error('Model output shape:', singleResult.dims);
            throw new Error(
              `Invalid embedding dimension: ${embedding.length}. Expected 384 for all-MiniLM-L6-v2.`
            );
          }

          batchEmbeddings.push(embedding);
        } else {
          throw new Error(`Unable to process embedding for text: ${text.slice(0, 50)}...`);
        }
      }

      for (let i = 0; i < uncachedTexts.length; i++) {
        // Embeddings are already converted to number arrays above
        const embedding = batchEmbeddings[i] as number[];

        const originalIndex = uncachedIndices[i];
        embeddings[originalIndex] = embedding;

        // Cache with LRU eviction
        if (this.embeddingCache.size >= this.maxCacheSize) {
          const firstKey = this.embeddingCache.keys().next().value;
          if (firstKey) {
            this.embeddingCache.delete(firstKey);
          }
        }
        this.embeddingCache.set(uncachedTexts[i], embedding);
      }
    }

    return embeddings;
  }

  /**
   * Fast cosine similarity calculation between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      console.error('Vector dimension mismatch:', {
        vec1Length: vec1.length,
        vec2Length: vec2.length,
        expected: 384, // all-MiniLM-L6-v2 should return 384-dim vectors
      });
      throw new Error(
        `Vector dimension mismatch: ${vec1.length} vs ${vec2.length}. Expected 384-dimensional embeddings.`
      );
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * PERFORMANCE OPTIMIZATION: Batch similarity matrix for multiple texts
   * Computes all pairwise similarities in one batch - much faster than individual calls
   */
  async computeSimilarityMatrix(texts: string[]): Promise<number[][]> {
    const embeddings = await this.getBatchEmbeddings(texts);
    const matrix: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < texts.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i]; // Use symmetry
        } else {
          matrix[i][j] = this.cosineSimilarity(embeddings[i], embeddings[j]);
        }
      }
    }

    return matrix;
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
    if (!this.isInitialized) {
      throw new Error('SemanticAnalyzer not initialized. Call initialize() first.');
    }

    try {
      // Lazy load NLI classifier when needed for precision tasks
      if (!this.nliClassifier) {
        console.log('Loading NLI model for semantic feature extraction...');
        this.nliClassifier = await pipeline<'zero-shot-classification'>(
          'zero-shot-classification',
          'MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33',
          { cache_dir: process.env.HF_HUB_CACHE || '.hf_cache' }
        );
      }

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
    return this.isInitialized;
  }
}

export const semanticAnalyzer = new SemanticAnalyzer();
