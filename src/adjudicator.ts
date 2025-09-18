import { Case } from './types.js';
import natural from 'natural';
import nlp from 'compromise';
import { semanticAnalyzer } from './semantic-analyzer.js';

// Extract needed components from natural
const { SentimentAnalyzer, PorterStemmer, WordTokenizer } = natural;

export class Adjudicator {
  private caseBase: Case[] = [];
  private caseIndex: Map<string, Case[]> = new Map(); // Index for faster retrieval
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    // Ensure semantic analyzer is initialized before use
    if (typeof (semanticAnalyzer as any).initialize === 'function') {
      await (semanticAnalyzer as any).initialize();
    }
    this.isInitialized = true;
  }

  private semanticIntents: string[] = [
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

  /**
   * Update semantic intents for domain-specific analysis
   */
  updateSemanticIntents(intents: string[]): void {
    if (intents.length > 0) {
      this.semanticIntents = intents;
    }
  }

  /**
   * Enhanced store experience with quality management and indexing
   */
  async storeExperience(case_: Case): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    // Extract semantic features for better retrieval
    try {
      // Check if semantic analyzer is available
      if (!semanticAnalyzer.isReady()) {
        throw new Error('SemanticAnalyzer is not ready');
      }

      const problemFeatures = await semanticAnalyzer.extractSemanticFeatures(
        case_.problem_description,
        this.semanticIntents
      );
      const solutionFeatures = await semanticAnalyzer.extractSemanticFeatures(
        case_.solution,
        this.semanticIntents
      );

      // Combine features from both problem and solution
      const combinedFeatures = {
        intents: [...(problemFeatures.intents || []), ...(solutionFeatures.intents || [])],
        sentiment: case_.outcome ? 'positive' : 'negative',
        keywords: this.extractKeywords(case_.problem_description + ' ' + case_.solution),
      };

      // Calculate initial confidence score based on various factors
      const confidenceScore = this.calculateCaseConfidence(
        case_,
        problemFeatures,
        solutionFeatures
      );

      // Enhance the case with computed features
      const enhancedCase: Case = {
        ...case_,
        semantic_features: combinedFeatures as any,
        confidence_score: confidenceScore,
        validation_score: this.validateCase(case_),
        usage_count: 0,
        success_rate: case_.outcome ? 1.0 : 0.0,
      };

      // Check for duplicates and quality
      if (this.isDuplicateCase(enhancedCase)) {
        this.updateExistingCase(enhancedCase);
        return;
      }

      if (confidenceScore < 0.3) {
        console.warn('Case rejected due to low confidence score:', confidenceScore);
        return;
      }

      // Store the case
      this.caseBase.push(enhancedCase);
      this.updateIndex(enhancedCase);

      // Manage case base size with intelligent pruning
      if (this.caseBase.length > 1000) {
        this.pruneeCaseBase();
      }
    } catch (error) {
      console.error('Error storing experience:', error);
      // Fallback to simple storage
      this.caseBase.push(case_);
    }
  }

  /**
   * Enhanced retrieve similar cases with filtering and semantic matching
   */
  async retrieveSimilarCases(
    problemDescription: string,
    maxResults: number = 5,
    filters: {
      context_filter?: string;
      difficulty_filter?: 'low' | 'medium' | 'high';
      outcome_filter?: boolean;
      min_similarity?: number;
    } = {}
  ): Promise<Case[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    try {
      // Check if semantic analyzer is available
      if (!semanticAnalyzer.isReady()) {
        throw new Error('SemanticAnalyzer is not ready');
      }

      // Extract semantic features from the query
      const queryFeatures = await semanticAnalyzer.extractSemanticFeatures(
        problemDescription,
        this.semanticIntents
      );

      // Filter cases based on provided filters
      let filteredCases = this.caseBase;

      if (filters.context_filter) {
        filteredCases = filteredCases.filter(
          (case_) =>
            case_.context?.includes(filters.context_filter!) ||
            case_.problem_description.includes(filters.context_filter!)
        );
      }

      if (filters.difficulty_filter) {
        filteredCases = filteredCases.filter(
          (case_) => case_.difficulty_level === filters.difficulty_filter
        );
      }

      if (filters.outcome_filter !== undefined) {
        filteredCases = filteredCases.filter((case_) => case_.outcome === filters.outcome_filter);
      }

      // Calculate enhanced similarity scores
      const scoredCases = await Promise.all(
        filteredCases.map(async (case_) => {
          const similarity = await this.calculateEnhancedSimilarity(
            problemDescription,
            case_.problem_description,
            queryFeatures,
            case_.semantic_features
          );

          // Apply usage-based boost for proven cases
          const usageBoost = Math.min(0.1, (case_.usage_count || 0) * 0.02);
          const successBoost = case_.outcome ? 0.05 : 0;
          const confidenceBoost = (case_.confidence_score || 0) * 0.1;

          const adjustedSimilarity = similarity + usageBoost + successBoost + confidenceBoost;

          return {
            case: {
              ...case_,
              similarity_metrics: {
                ...case_.similarity_metrics,
                combined_similarity: adjustedSimilarity,
              },
            },
            similarity: adjustedSimilarity,
          };
        })
      );

      // Filter by minimum similarity threshold
      const minSimilarity = filters.min_similarity || 0.1;
      const validCases = scoredCases.filter((item) => item.similarity >= minSimilarity);

      // Sort by similarity and success rate
      const sortedCases = validCases.sort((a, b) => {
        // Primary sort by similarity
        if (Math.abs(a.similarity - b.similarity) > 0.05) {
          return b.similarity - a.similarity;
        }
        // Secondary sort by success rate for similar cases
        const aSuccessRate = a.case.success_rate || (a.case.outcome ? 1 : 0);
        const bSuccessRate = b.case.success_rate || (b.case.outcome ? 1 : 0);
        return bSuccessRate - aSuccessRate;
      });

      // Update usage statistics for retrieved cases
      const results = sortedCases.slice(0, maxResults);
      results.forEach((item) => {
        item.case.usage_count = (item.case.usage_count || 0) + 1;
      });

      return results.map((item) => item.case);
    } catch (error) {
      console.error('Error retrieving similar cases:', error);
      // Fallback to simple similarity matching
      return this.fallbackRetrieveSimilarCases(problemDescription, maxResults);
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

  /**
   * Enhanced similarity calculation combining semantic and traditional methods
   */
  private async calculateEnhancedSimilarity(
    query: string,
    caseDescription: string,
    queryFeatures: any,
    caseFeatures: any
  ): Promise<number> {
    // Get semantic similarity from semantic analyzer
    const semanticResult = await semanticAnalyzer.calculateSemanticSimilarity(
      query,
      caseDescription
    );
    const semanticSimilarity = semanticResult.similarity;

    // Traditional NLP similarity (fallback)
    const traditionalSimilarity = this.calculateCaseSimilarity(query, caseDescription);

    // Feature-based similarity
    const featureSimilarity = this.calculateFeatureSimilarity(queryFeatures, caseFeatures);

    // Combine similarities with weights
    const combinedSimilarity =
      semanticSimilarity * 0.5 + traditionalSimilarity * 0.3 + featureSimilarity * 0.2;

    return Math.max(0, Math.min(1, combinedSimilarity));
  }

  /**
   * Calculate similarity between semantic features
   */
  private calculateFeatureSimilarity(features1: any, features2: any): number {
    if (!features1 || !features2) return 0;

    let similarity = 0;
    let weights = 0;

    // Intent similarity
    if (features1.intents && features2.intents) {
      const intentOverlap = this.calculateArrayOverlap(features1.intents, features2.intents);
      similarity += intentOverlap * 0.4;
      weights += 0.4;
    }

    // Keyword similarity
    if (features1.keywords && features2.keywords) {
      const keywordOverlap = this.calculateArrayOverlap(features1.keywords, features2.keywords);
      similarity += keywordOverlap * 0.4;
      weights += 0.4;
    }

    // Sentiment similarity
    if (features1.sentiment && features2.sentiment) {
      const sentimentMatch = features1.sentiment === features2.sentiment ? 1 : 0;
      similarity += sentimentMatch * 0.2;
      weights += 0.2;
    }

    return weights > 0 ? similarity / weights : 0;
  }

  /**
   * Calculate overlap between two arrays
   */
  private calculateArrayOverlap(arr1: string[], arr2: string[]): number {
    if (!arr1.length || !arr2.length) return 0;

    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Extract keywords from text using simple heuristics
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);

    return words
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
      .slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Calculate confidence score for a case
   */
  private calculateCaseConfidence(
    case_: Case,
    problemFeatures: any,
    solutionFeatures: any
  ): number {
    let confidence = 0.5; // Base confidence

    // Length-based confidence (longer descriptions tend to be more detailed)
    const descriptionLength = case_.problem_description.length + case_.solution.length;
    confidence += Math.min(0.2, (descriptionLength / 1000) * 0.2);

    // Feature quality confidence
    const featureCount =
      (problemFeatures.intents?.length || 0) + (solutionFeatures.intents?.length || 0);
    confidence += Math.min(0.2, featureCount * 0.05);

    // Sentiment consistency (positive sentiment for successful cases)
    if (
      case_.outcome &&
      (problemFeatures.sentiment === 'positive' || solutionFeatures.sentiment === 'positive')
    ) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Validate case quality
   */
  private validateCase(case_: Case): number {
    let score = 0.5; // Base score

    // Check for minimum description length
    if (case_.problem_description.length < 10 || case_.solution.length < 10) {
      score -= 0.3;
    }

    // Check for generic or vague descriptions
    const genericTerms = ['error', 'problem', 'issue', 'failed', 'broken'];
    const genericCount = genericTerms.reduce(
      (count, term) => count + (case_.problem_description.toLowerCase().includes(term) ? 1 : 0),
      0
    );
    score -= genericCount * 0.1;

    // Bonus for specific context information
    if (case_.context && case_.context.length > 5) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if case is duplicate
   */
  private isDuplicateCase(newCase: Case): boolean {
    return this.caseBase.some(
      (existingCase) =>
        this.calculateCaseSimilarity(
          newCase.problem_description,
          existingCase.problem_description
        ) > 0.9 && this.calculateCaseSimilarity(newCase.solution, existingCase.solution) > 0.9
    );
  }

  /**
   * Update existing case with new information
   */
  private updateExistingCase(newCase: Case): void {
    const existingIndex = this.caseBase.findIndex(
      (existingCase) =>
        this.calculateCaseSimilarity(
          newCase.problem_description,
          existingCase.problem_description
        ) > 0.9 && this.calculateCaseSimilarity(newCase.solution, existingCase.solution) > 0.9
    );

    if (existingIndex !== -1) {
      const existing = this.caseBase[existingIndex];
      // Update success rate
      const totalUses = (existing.usage_count || 0) + 1;
      const previousSuccesses = (existing.success_rate || 0) * (existing.usage_count || 0);
      const newSuccesses = previousSuccesses + (newCase.outcome ? 1 : 0);

      existing.success_rate = newSuccesses / totalUses;
      existing.usage_count = totalUses;
      existing.timestamp = Date.now();
    }
  }

  /**
   * Update case index for faster retrieval
   */
  private updateIndex(case_: Case): void {
    // Index by context
    if (case_.context) {
      if (!this.caseIndex.has(case_.context)) {
        this.caseIndex.set(case_.context, []);
      }
      this.caseIndex.get(case_.context)!.push(case_);
    }
  }

  /**
   * Intelligent case base pruning
   */
  private pruneeCaseBase(): void {
    // Sort by quality score combining multiple factors
    const scoredCases = this.caseBase.map((case_) => ({
      case: case_,
      quality: this.calculateCaseQuality(case_),
    }));

    // Keep top 800 cases
    const prunedCases = scoredCases
      .sort((a, b) => b.quality - a.quality)
      .slice(0, 800)
      .map((item) => item.case);

    this.caseBase = prunedCases;
    this.rebuildIndex();
  }

  /**
   * Calculate overall case quality for pruning decisions
   */
  private calculateCaseQuality(case_: Case): number {
    let quality = 0;

    // Success rate contribution
    quality += (case_.success_rate || 0) * 0.3;

    // Usage count contribution (normalized)
    quality += Math.min(0.2, ((case_.usage_count || 0) / 10) * 0.2);

    // Confidence score contribution
    quality += (case_.confidence_score || 0) * 0.2;

    // Validation score contribution
    quality += (case_.validation_score || 0) * 0.2;

    // Recency contribution (newer cases get slight boost)
    const ageDays = (Date.now() - (case_.timestamp || 0)) / (1000 * 60 * 60 * 24);
    quality += Math.max(0, 0.1 - ageDays * 0.001);

    return quality;
  }

  /**
   * Rebuild index after pruning
   */
  private rebuildIndex(): void {
    this.caseIndex.clear();
    this.caseBase.forEach((case_) => this.updateIndex(case_));
  }

  /**
   * Fallback method for case retrieval when semantic analysis fails
   */
  private fallbackRetrieveSimilarCases(problemDescription: string, maxResults: number): Case[] {
    const scoredCases = this.caseBase.map((case_) => ({
      case: case_,
      similarity: this.calculateCaseSimilarity(problemDescription, case_.problem_description),
    }));

    return scoredCases
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
      .map((item) => item.case);
  }
}
