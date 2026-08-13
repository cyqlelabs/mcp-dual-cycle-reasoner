// @ts-nocheck
import { describe, it, expect, jest } from '@jest/globals';

// Mock chalk to avoid ES module issues in Jest
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
    gray: (str: string) => str,
    magenta: (str: string) => str,
    cyan: (str: string) => str,
  },
}));

// Mock semantic analyzer with low pairwise similarity so semantic clustering
// stays out of the way and the tested signals are deterministic
jest.mock('../src/semantic-analyzer', () => ({
  semanticAnalyzer: {
    initialize: jest.fn(async () => {}),
    isReady: jest.fn(() => true),
    clearSessionCache: jest.fn(),
    extractSemanticFeatures: jest.fn(async () => ({
      intents: ['performing action'],
      sentiment: 'positive',
      confidence: 0.8,
    })),
    calculateSemanticSimilarity: jest.fn(async () => ({
      similarity: 0,
      confidence: 0.5,
      reasoning: 'Mock similarity',
    })),
    getBatchEmbeddings: jest.fn(async (texts) => texts.map(() => Array(384).fill(0.5))),
    computeSimilarityMatrix: jest.fn(async (texts) =>
      texts.map((_, i) => texts.map((__, j) => (i === j ? 1.0 : 0.1)))
    ),
  },
}));

import { Sentinel } from '../src/sentinel';
import { Adjudicator } from '../src/adjudicator';
import { DualCycleEngine } from '../src/dual-cycle-engine';

describe('Core engine fixes', () => {
  describe('Sentinel state history bound', () => {
    it('should never grow the state history beyond its maximum size', async () => {
      const sentinel = new Sentinel({ min_actions_for_detection: 1 });

      for (let i = 0; i < 40; i++) {
        await sentinel.detectLoop(
          {
            last_action: 'action_c',
            goal: 'test goal',
            current_context: `context_${i}`,
            recent_actions: ['action_a', 'action_b', 'action_c'],
          },
          'pattern'
        );
      }

      // Each detection pushes two hashes; the bound must still hold
      expect((sentinel as any).stateHistory.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Sentinel configuration handling', () => {
    it('should respect explicit zero values in the configuration', () => {
      const sentinel = new Sentinel({
        min_actions_for_detection: 0,
        alternating_threshold: 0,
        repetition_threshold: 0,
        progress_threshold_adjustment: 0,
      });

      const config = sentinel.getConfig();
      expect(config.min_actions_for_detection).toBe(0);
      expect(config.alternating_threshold).toBe(0);
      expect(config.repetition_threshold).toBe(0);
      expect(config.progress_threshold_adjustment).toBe(0);
    });

    it('should ignore undefined values in updateConfig', () => {
      const sentinel = new Sentinel({ min_actions_for_detection: 7 });

      sentinel.updateConfig({
        min_actions_for_detection: undefined,
        repetition_threshold: 0.9,
      });

      const config = sentinel.getConfig();
      expect(config.min_actions_for_detection).toBe(7);
      expect(config.repetition_threshold).toBe(0.9);
    });

    it('should preserve statistical_analysis thresholds from the constructor', () => {
      const sentinel = new Sentinel({
        statistical_analysis: {
          entropy_threshold: 0.5,
          variance_threshold: 0.2,
          trend_threshold: 0.3,
          cyclicity_threshold: 0.4,
        },
      });

      expect(sentinel.getConfig().statistical_analysis).toEqual({
        entropy_threshold: 0.5,
        variance_threshold: 0.2,
        trend_threshold: 0.3,
        cyclicity_threshold: 0.4,
      });
    });
  });

  describe('Sentinel statistical anomaly detection', () => {
    it('should score repetitive sequences much higher than diverse ones', () => {
      const sentinel = new Sentinel();

      const repetitiveScore = (sentinel as any).detectStatisticalAnomalies([
        'same_action',
        'same_action',
        'same_action',
        'same_action',
        'same_action',
      ]);
      const diverseScore = (sentinel as any).detectStatisticalAnomalies([
        'alpha_one',
        'beta_two',
        'gamma_three',
        'delta_four',
        'epsilon_five',
      ]);

      // Pure repetition: zero entropy and zero hash variance
      expect(repetitiveScore).toBeGreaterThan(0.9);
      // Fully diverse: maximal entropy and large hash variance
      expect(diverseScore).toBeLessThan(0.2);
    });

    it('should honor a configured variance threshold', () => {
      const permissiveVariance = new Sentinel({
        statistical_analysis: {
          entropy_threshold: 0.6,
          variance_threshold: Number.MAX_SAFE_INTEGER,
          trend_threshold: 0.1,
          cyclicity_threshold: 0.3,
        },
      });
      const defaultSentinel = new Sentinel();

      const diverseActions = ['alpha_one', 'beta_two', 'gamma_three', 'delta_four', 'epsilon_five'];

      const configuredScore = (permissiveVariance as any).detectStatisticalAnomalies(
        diverseActions
      );
      const defaultScore = (defaultSentinel as any).detectStatisticalAnomalies(diverseActions);

      // With an unbounded variance threshold every sequence counts as low-variance
      expect(configuredScore).toBeGreaterThan(defaultScore);
      expect(configuredScore).toBeCloseTo(0.24, 2);
      expect(defaultScore).toBeCloseTo(0.06, 2);
    });
  });

  describe('Sentinel repetition threshold wiring', () => {
    const trace = {
      last_action: 'action_e',
      goal: 'test goal',
      recent_actions: ['action_a', 'action_a', 'action_b', 'action_c', 'action_d', 'action_e'],
    };

    it('should flag a loop when the repetition score crosses the configured threshold', async () => {
      const lenient = new Sentinel({ repetition_threshold: 0.15 });

      // exact_repetition = 1 - 5/6 ≈ 0.167 >= 0.15
      const result = await lenient.detectActionAnomalies(trace);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('action_repetition');
    });

    it('should not flag the same trace when the threshold is strict', async () => {
      const strict = new Sentinel({ repetition_threshold: 0.95 });

      const result = await strict.detectActionAnomalies(trace);

      expect(result.detected).toBe(false);
    });
  });

  describe('DualCycleEngine monitoring status', () => {
    it('should expose recent actions with timestamps', async () => {
      const engine = new DualCycleEngine();
      await engine.startMonitoring('test goal');

      await engine.processTraceUpdate('first_action', 'ctx');
      await engine.processTraceUpdate('second_action', 'ctx');

      const status = engine.getMonitoringStatus();
      expect(status.recent_actions).toHaveLength(2);
      expect(status.recent_actions[0]).toEqual({
        type: 'first_action',
        timestamp: expect.any(Number),
      });
      expect(status.recent_actions[1].type).toBe('second_action');
    });

    it('should cap recent actions at 10 while keeping the full trace length', async () => {
      const engine = new DualCycleEngine();
      await engine.startMonitoring('test goal');

      for (let i = 0; i < 14; i++) {
        await engine.processTraceUpdate(`step_${i}`, 'ctx');
      }

      const status = engine.getMonitoringStatus();
      expect(status.trace_length).toBe(14);
      expect(status.recent_actions).toHaveLength(10);
      expect(status.recent_actions[0].type).toBe('step_4');
      expect(status.recent_actions[9].type).toBe('step_13');
    });

    it('should clear recent actions on reset', async () => {
      const engine = new DualCycleEngine();
      await engine.startMonitoring('test goal');
      await engine.processTraceUpdate('some_action', 'ctx');

      engine.reset();

      expect(engine.getMonitoringStatus().recent_actions).toHaveLength(0);
    });
  });

  describe('Adjudicator minimum similarity threshold', () => {
    it('should honor an explicit zero min_similarity instead of the 0.6 default', async () => {
      const adjudicator = new Adjudicator();
      await adjudicator.storeExperience({
        problem_description: 'The quick brown fox jumps over the lazy dog',
        solution: 'Restart the router and try again',
        outcome: true,
        usage_count: 0,
      });

      const defaultThreshold = await adjudicator.retrieveSimilarCases(
        'zzz completely unrelated query',
        5,
        {}
      );
      const zeroThreshold = await adjudicator.retrieveSimilarCases(
        'zzz completely unrelated query',
        5,
        { min_similarity: 0 }
      );

      expect(defaultThreshold).toHaveLength(0);
      expect(zeroThreshold).toHaveLength(1);
    });
  });
});
