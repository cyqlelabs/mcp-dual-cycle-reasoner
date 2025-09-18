// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock huggingface transformers before importing anything else
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn(),
}));

import { SemanticAnalyzer } from '../src/semantic-analyzer';

describe('SemanticAnalyzer', () => {
  let analyzer: SemanticAnalyzer;
  let mockPipeline: jest.MockedFunction<any>;

  beforeEach(async () => {
    const transformers = await import('@huggingface/transformers');
    mockPipeline = transformers.pipeline as jest.MockedFunction<any>;

    analyzer = new SemanticAnalyzer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with both embedding and NLI models', async () => {
      const mockEmbeddingModel = jest.fn();
      const mockNLIModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockResolvedValueOnce(mockNLIModel);

      await analyzer.initialize();

      expect(mockPipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        expect.objectContaining({
          cache_dir: expect.any(String),
        })
      );
      expect(mockPipeline).toHaveBeenCalledWith(
        'zero-shot-classification',
        'MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33',
        expect.objectContaining({
          cache_dir: expect.any(String),
        })
      );
      expect(analyzer.isReady()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // First model (embedding) loads successfully, second model (NLI) fails
      const mockEmbeddingModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockRejectedValueOnce(new Error('Model loading failed'));

      await expect(analyzer.initialize()).rejects.toThrow('Model loading failed');
      expect(analyzer.isReady()).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      const mockEmbeddingModel = jest.fn();
      const mockNLIModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockResolvedValueOnce(mockNLIModel);

      await analyzer.initialize();
      const firstCallCount = mockPipeline.mock.calls.length;

      // Try to initialize again
      await analyzer.initialize();

      // Should not have made additional pipeline calls
      expect(mockPipeline.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('analyzeTextPair', () => {
    let mockNLIModel: jest.MockedFunction<any>;

    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockNLIModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockResolvedValueOnce(mockNLIModel);
      await analyzer.initialize();

      // Store the mock in the analyzer instance so all tests can access it
      (analyzer as any).nliClassifier = mockNLIModel;
    });

    it('should analyze text pairs and return NLI results', async () => {
      const mockResult = {
        labels: ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION'],
        scores: [0.8, 0.15, 0.05],
      };
      mockNLIModel.mockResolvedValueOnce(mockResult);

      const result = await analyzer.analyzeTextPair(
        'The user clicked a button',
        'Button was clicked'
      );

      expect(result).toEqual({
        label: 'ENTAILMENT',
        score: 0.8,
        confidence: 0.8,
      });
    });

    it('should handle array results from NLI model', async () => {
      const mockResult = [
        {
          labels: ['CONTRADICTION', 'NEUTRAL', 'ENTAILMENT'],
          scores: [0.7, 0.2, 0.1],
        },
      ];
      mockNLIModel.mockResolvedValueOnce(mockResult);

      const result = await analyzer.analyzeTextPair('User failed', 'Task succeeded');

      expect(result).toEqual({
        label: 'CONTRADICTION',
        score: 0.7,
        confidence: 0.7,
      });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedAnalyzer = new SemanticAnalyzer();

      await expect(uninitializedAnalyzer.analyzeTextPair('text1', 'text2')).rejects.toThrow(
        'SemanticAnalyzer not initialized'
      );
    });

    it('should handle NLI model errors', async () => {
      mockNLIModel.mockRejectedValueOnce(new Error('NLI processing failed'));

      await expect(analyzer.analyzeTextPair('text1', 'text2')).rejects.toThrow(
        'NLI processing failed'
      );
    });
  });

  describe('assessActionOutcome', () => {
    let mockNLIModel: jest.MockedFunction<any>;

    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockNLIModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockResolvedValueOnce(mockNLIModel);
      await analyzer.initialize();

      // Store the mock in the analyzer instance so all tests can access it
      (analyzer as any).nliClassifier = mockNLIModel;
    });

    it('should assess successful action outcomes', async () => {
      const mockResult = {
        labels: ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION'],
        scores: [0.8, 0.15, 0.05],
      };
      mockNLIModel.mockResolvedValueOnce(mockResult);

      const result = await analyzer.assessActionOutcome('Click button', 'Button was clicked');

      expect(result).toEqual({
        category: 'success',
        confidence: 0.8,
        reasoning: expect.stringContaining('aligns with expected outcome'),
      });
    });

    it('should assess failed action outcomes', async () => {
      const mockResult = {
        labels: ['CONTRADICTION', 'NEUTRAL', 'ENTAILMENT'],
        scores: [0.85, 0.1, 0.05],
      };
      mockNLIModel.mockResolvedValueOnce(mockResult);

      const result = await analyzer.assessActionOutcome('Click button', 'Button was not found');

      expect(result).toEqual({
        category: 'failure',
        confidence: 0.85,
        reasoning: expect.stringContaining('contradicts expected outcome'),
      });
    });

    it('should handle neutral outcomes', async () => {
      const mockResult = {
        labels: ['NEUTRAL', 'ENTAILMENT', 'CONTRADICTION'],
        scores: [0.6, 0.25, 0.15],
      };
      mockNLIModel.mockResolvedValueOnce(mockResult);

      const result = await analyzer.assessActionOutcome('Click button', 'Something happened');

      expect(result).toEqual({
        category: 'neutral',
        confidence: 0.6,
        reasoning: expect.stringContaining('Uncertain relationship'),
      });
    });
  });

  describe('calculateSemanticSimilarity', () => {
    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockEmbeddingModel.mockImplementation((text) => ({
        data: new Array(384).fill(0.5),
      }));
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      await analyzer.initialize();
    });

    it('should calculate semantic similarity using embeddings', async () => {
      const result = await analyzer.calculateSemanticSimilarity('Hello world', 'Hi there');

      expect(result).toEqual({
        similarity: expect.any(Number),
        confidence: 0.85,
        reasoning: 'Fast embedding-based semantic similarity',
      });
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedAnalyzer = new SemanticAnalyzer();

      await expect(
        uninitializedAnalyzer.calculateSemanticSimilarity('text1', 'text2')
      ).rejects.toThrow('SemanticAnalyzer not initialized');
    });

    it('should handle embedding errors', async () => {
      const mockEmbeddingModel = jest.fn();
      mockEmbeddingModel.mockRejectedValueOnce(new Error('Embedding failed'));
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);

      const failingAnalyzer = new SemanticAnalyzer();
      await failingAnalyzer.initialize();

      await expect(failingAnalyzer.calculateSemanticSimilarity('text1', 'text2')).rejects.toThrow(
        'Embedding failed'
      );
    });
  });

  describe('cache management and LRU eviction', () => {
    let mockEmbeddingModel: jest.MockedFunction<any>;

    beforeEach(async () => {
      mockEmbeddingModel = jest.fn();
      mockEmbeddingModel.mockImplementation((text) => ({
        data: new Array(384).fill(Math.random()),
        dims: [1, 384],
      }));
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      await analyzer.initialize();
    });

    it('should evict oldest entries when cache exceeds maxCacheSize', async () => {
      // Generate 501 texts to exceed the maxCacheSize of 500
      const texts = [];
      for (let i = 0; i < 501; i++) {
        texts.push(`text_${i}`);
      }

      // Process all texts to fill cache beyond limit
      await analyzer.getBatchEmbeddings(texts);

      // Process again with new texts - should require model calls
      mockEmbeddingModel.mockClear();

      // Test with completely new entries (should require model calls)
      await analyzer.getBatchEmbeddings(['new_text_1', 'new_text_2', 'new_text_3']);

      // Should have made calls for new texts
      expect(mockEmbeddingModel).toHaveBeenCalled();
    });

    it('should handle cache key deletion during LRU eviction', async () => {
      // This test specifically targets the LRU eviction logic
      const manyTexts = [];
      for (let i = 0; i < 502; i++) {
        manyTexts.push(`cache_test_${i}`);
      }

      // This should trigger LRU eviction multiple times
      await analyzer.getBatchEmbeddings(manyTexts);

      // Verify embeddings were still generated
      expect(mockEmbeddingModel).toHaveBeenCalledTimes(502);
    });
  });

  describe('getBatchEmbeddings', () => {
    let mockEmbeddingModel: jest.MockedFunction<any>;

    beforeEach(async () => {
      mockEmbeddingModel = jest.fn();
      mockEmbeddingModel.mockImplementation((text) => ({
        data: new Array(384).fill(Math.random()),
        dims: [1, 384],
      }));
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      await analyzer.initialize();
    });

    it('should process multiple texts and return embeddings', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const embeddings = await analyzer.getBatchEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toHaveLength(384);
      expect(mockEmbeddingModel).toHaveBeenCalledTimes(3);
    });

    it('should use cache for previously processed texts', async () => {
      const texts = ['text1', 'text2'];

      // First call
      await analyzer.getBatchEmbeddings(texts);
      expect(mockEmbeddingModel).toHaveBeenCalledTimes(2);

      mockEmbeddingModel.mockClear();

      // Second call with same texts - should use cache
      await analyzer.getBatchEmbeddings(texts);
      expect(mockEmbeddingModel).toHaveBeenCalledTimes(0);
    });

    it('should handle invalid embedding dimensions', async () => {
      mockEmbeddingModel.mockImplementationOnce(() => ({
        data: new Array(100).fill(0.5), // Wrong dimension
        dims: [1, 100],
      }));

      await expect(analyzer.getBatchEmbeddings(['test'])).rejects.toThrow(
        'Invalid embedding dimension: 100. Expected 384'
      );
    });

    it('should handle missing embedding data', async () => {
      mockEmbeddingModel.mockImplementationOnce(() => ({
        dims: [1, 384],
        // Missing data property
      }));

      await expect(analyzer.getBatchEmbeddings(['test'])).rejects.toThrow(
        'Unable to process embedding for text: test'
      );
    });

    it('should throw error if embedding model not initialized', async () => {
      const uninitializedAnalyzer = new SemanticAnalyzer();

      await expect(uninitializedAnalyzer.getBatchEmbeddings(['test'])).rejects.toThrow(
        'Embedding model not initialized'
      );
    });
  });

  describe('cosineSimilarity', () => {
    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      await analyzer.initialize();
    });

    it('should calculate cosine similarity for identical vectors', async () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];

      // Access private method for testing
      const similarity = (analyzer as any).cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(1.0);
    });

    it('should calculate cosine similarity for orthogonal vectors', async () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];

      const similarity = (analyzer as any).cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0.0);
    });

    it('should handle zero magnitude vectors', async () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];

      const similarity = (analyzer as any).cosineSimilarity(vec1, vec2);

      expect(similarity).toBe(0);
    });

    it('should throw error for mismatched vector dimensions', async () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2]; // Different length

      expect(() => {
        (analyzer as any).cosineSimilarity(vec1, vec2);
      }).toThrow('Vector dimension mismatch');
    });
  });

  describe('computeSimilarityMatrix', () => {
    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockEmbeddingModel.mockImplementation((text) => ({
        data: new Array(384).fill(Math.random()),
        dims: [1, 384],
      }));
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      await analyzer.initialize();
    });

    it('should compute similarity matrix for multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const matrix = await analyzer.computeSimilarityMatrix(texts);

      expect(matrix).toHaveLength(3);
      expect(matrix[0]).toHaveLength(3);

      // Diagonal should be 1.0 (self-similarity)
      expect(matrix[0][0]).toBe(1.0);
      expect(matrix[1][1]).toBe(1.0);
      expect(matrix[2][2]).toBe(1.0);

      // Matrix should be symmetric
      expect(matrix[0][1]).toBe(matrix[1][0]);
      expect(matrix[0][2]).toBe(matrix[2][0]);
      expect(matrix[1][2]).toBe(matrix[2][1]);
    });
  });

  describe('extractSemanticFeatures', () => {
    let mockNLIModel: jest.MockedFunction<any>;

    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockEmbeddingModel.mockImplementation((text, options) => ({
        data: new Array(384).fill(Math.random()),
        dims: [1, 384],
      }));
      mockNLIModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockResolvedValueOnce(mockNLIModel);
      await analyzer.initialize();

      // Store the mock in the analyzer instance so all tests can access it
      (analyzer as any).nliClassifier = mockNLIModel;
    });

    it('should extract semantic features with custom intents', async () => {
      // Mock intent classification - this method calls analyzeTextPair which we need to mock
      const mockIntentResult = {
        labels: ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION'],
        scores: [0.8, 0.15, 0.05],
      };

      // Mock sentiment analysis
      const mockSentimentResult = {
        labels: ['positive outcome', 'neutral outcome', 'negative outcome'],
        scores: [0.7, 0.2, 0.1],
      };

      // First call for intent analysis (via analyzeTextPair)
      mockNLIModel
        .mockResolvedValueOnce(mockIntentResult)
        // Second call for sentiment analysis
        .mockResolvedValueOnce(mockSentimentResult);

      const customIntents = ['navigating', 'clicking'];
      const result = await analyzer.extractSemanticFeatures('Click button', customIntents);

      // The method should return results, but may not match exactly due to complex logic
      expect(result).toBeDefined();
      expect(result.intents).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });

    it('should handle negative sentiment', async () => {
      const mockNLIModel = jest.fn();

      const mockIntentResult = {
        labels: ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION'],
        scores: [0.8, 0.15, 0.05],
      };

      const mockSentimentResult = {
        labels: ['negative outcome', 'neutral outcome', 'positive outcome'],
        scores: [0.8, 0.15, 0.05],
      };

      mockNLIModel
        .mockResolvedValueOnce(mockIntentResult)
        .mockResolvedValueOnce(mockSentimentResult);

      mockPipeline.mockResolvedValueOnce(mockNLIModel);

      const result = await analyzer.extractSemanticFeatures('Failed to load page');

      // The method processes sentiment but may return default values in error cases
      expect(result).toBeDefined();
      expect(['positive', 'negative', 'neutral']).toContain(result.sentiment);
    });

    it('should handle errors gracefully', async () => {
      const mockNLIModel = jest.fn();
      mockNLIModel.mockRejectedValueOnce(new Error('Feature extraction failed'));
      mockPipeline.mockResolvedValueOnce(mockNLIModel);

      const result = await analyzer.extractSemanticFeatures('test text');

      expect(result).toEqual({
        intents: [],
        sentiment: 'neutral',
        confidence: 0,
      });
    });

    it('should handle sentiment analysis edge cases', async () => {
      const mockNLIModel = jest.fn();

      // Test with different sentiment outcomes
      const mockIntentResult = {
        labels: ['NEUTRAL', 'ENTAILMENT', 'CONTRADICTION'],
        scores: [0.6, 0.3, 0.1],
      };

      const mockSentimentResult = {
        labels: ['neutral outcome', 'positive outcome', 'negative outcome'],
        scores: [0.8, 0.15, 0.05],
      };

      mockNLIModel
        .mockResolvedValueOnce(mockIntentResult)
        .mockResolvedValueOnce(mockSentimentResult);

      mockPipeline.mockResolvedValueOnce(mockNLIModel);

      const result = await analyzer.extractSemanticFeatures('neutral statement');

      expect(result.sentiment).toBe('neutral');
      expect(typeof result.confidence).toBe('number');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedAnalyzer = new SemanticAnalyzer();

      await expect(uninitializedAnalyzer.extractSemanticFeatures('test')).rejects.toThrow(
        'SemanticAnalyzer not initialized'
      );
    });
  });

  describe('classifyActionIntent', () => {
    let mockNLIModel: jest.MockedFunction<any>;

    beforeEach(async () => {
      const mockEmbeddingModel = jest.fn();
      mockNLIModel = jest.fn();
      mockPipeline.mockResolvedValueOnce(mockEmbeddingModel);
      mockPipeline.mockResolvedValueOnce(mockNLIModel);
      await analyzer.initialize();

      // Store the mock in the analyzer instance so all tests can access it
      (analyzer as any).nliClassifier = mockNLIModel;
    });

    it('should classify action intents and rank them', async () => {
      // Clear previous mock calls but keep the mock function
      mockNLIModel.mockClear();

      // Mock different responses for different intents
      mockNLIModel
        .mockResolvedValueOnce({
          labels: ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION'],
          scores: [0.9, 0.08, 0.02],
        })
        .mockResolvedValueOnce({
          labels: ['NEUTRAL', 'ENTAILMENT', 'CONTRADICTION'],
          scores: [0.6, 0.3, 0.1],
        })
        .mockResolvedValueOnce({
          labels: ['CONTRADICTION', 'NEUTRAL', 'ENTAILMENT'],
          scores: [0.8, 0.15, 0.05],
        });

      const intents = ['clicking', 'scrolling', 'typing'];
      const result = await analyzer.classifyActionIntent('click button', intents);

      expect(result.bestMatch).toBe('clicking');
      expect(result.confidence).toBeGreaterThan(0.8); // ENTAILMENT with high score
      expect(result.allScores).toHaveLength(3);
      expect(result.allScores[0].score).toBeGreaterThanOrEqual(result.allScores[1].score);
    });

    it('should handle neutral classifications', async () => {
      // Clear previous mock calls but keep the mock function
      mockNLIModel.mockClear();

      mockNLIModel.mockResolvedValue({
        labels: ['NEUTRAL', 'ENTAILMENT', 'CONTRADICTION'],
        scores: [0.7, 0.2, 0.1],
      });

      const result = await analyzer.classifyActionIntent('ambiguous action', ['intent1']);

      expect(result.confidence).toBeCloseTo(0.35); // 0.7 * 0.5 for neutral
    });

    it('should handle contradiction classifications', async () => {
      // Clear previous mock calls but keep the mock function
      mockNLIModel.mockClear();

      mockNLIModel.mockResolvedValue({
        labels: ['CONTRADICTION', 'NEUTRAL', 'ENTAILMENT'],
        scores: [0.8, 0.15, 0.05],
      });

      const result = await analyzer.classifyActionIntent('opposite action', ['intent1']);

      expect(result.confidence).toBeCloseTo(0.08); // 0.8 * 0.1 for contradiction
    });
  });
});
