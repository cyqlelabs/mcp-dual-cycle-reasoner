// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock semantic analyzer to avoid tensor issues
jest.mock('../src/semantic-analyzer', () => ({
  semanticAnalyzer: {
    initialize: jest.fn(async () => {}),
    calculateSemanticSimilarity: jest.fn(async () => ({
      similarity: 0.8,
      confidence: 0.9,
      reasoning: 'Mock similarity',
    })),
    extractSemanticFeatures: jest.fn(async () => ({
      intents: ['performing action'],
      sentiment: 'positive',
      confidence: 0.8,
    })),
    getBatchEmbeddings: jest.fn(async (texts) => texts.map(() => Array(384).fill(0.5))),
    computeSimilarityMatrix: jest.fn(async (texts) => {
      const n = texts.length;
      return Array(n)
        .fill()
        .map((_, i) =>
          Array(n)
            .fill()
            .map((_, j) => (i === j ? 1.0 : 0.7))
        );
    }),
    isReady: jest.fn(() => true),
  },
}));

import { DualCycleEngine } from '../src/dual-cycle-engine.js';
import { SentinelConfig } from '../src/types.js';

describe('DualCycleEngine', () => {
  let engine: DualCycleEngine;

  beforeEach(() => {
    engine = new DualCycleEngine();
  });

  afterEach(() => {
    engine.reset();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
      expect(status.intervention_count).toBe(0);
      expect(status.trace_length).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const config: Partial<SentinelConfig> = {
        min_actions_for_detection: 3,
        alternating_threshold: 0.7,
        progress_indicators: ['success', 'complete'],
      };

      const customEngine = new DualCycleEngine(config);
      expect(customEngine).toBeDefined();

      const status = customEngine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start monitoring correctly', async () => {
      const goal = 'Test goal';
      const beliefs = ['belief1', 'belief2'];

      await engine.startMonitoring(goal, beliefs);

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe(goal);
      expect(status.intervention_count).toBe(0);
      expect(status.trace_length).toBe(0);
    });

    it('should stop monitoring correctly', async () => {
      await engine.startMonitoring('Test goal');
      engine.stopMonitoring();

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
    });

    it('should reset engine state', async () => {
      await engine.startMonitoring('Test goal');
      await engine.processTraceUpdate('test_action');

      engine.reset();

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
      expect(status.intervention_count).toBe(0);
      expect(status.trace_length).toBe(0);
      expect(status.current_goal).toBe('');
    });
  });

  describe('trace processing', () => {
    beforeEach(async () => {
      await engine.startMonitoring('Test goal for trace processing');
    });

    it('should process single trace update without intervention', async () => {
      const result = await engine.processTraceUpdate('click_button', 'test context');

      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected).toBeDefined();
      expect(result.loop_detected?.detected).toBe(false);

      const status = engine.getMonitoringStatus();
      expect(status.trace_length).toBe(1);
    });

    it('should not process updates when not monitoring', async () => {
      engine.stopMonitoring();

      const result = await engine.processTraceUpdate('test_action');

      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected).toBeUndefined();
    });

    it('should accumulate actions correctly', async () => {
      await engine.processTraceUpdate('action1');
      await engine.processTraceUpdate('action2');
      await engine.processTraceUpdate('action3');

      const status = engine.getMonitoringStatus();
      expect(status.trace_length).toBe(3);

      const trace = engine.getEnrichedCurrentTrace();
      expect(trace.recent_actions).toEqual(['action1', 'action2', 'action3']);
    });

    it('should update trace properties', async () => {
      await engine.processTraceUpdate('test_action', 'new context', 'new goal');

      const trace = engine.getCurrentTrace();
      expect(trace.last_action).toBe('test_action');
      expect(trace.current_context).toBe('new context');
      expect(trace.goal).toBe('new goal');
    });

    it('should detect loops with sufficient repetition', async () => {
      // Generate enough repeated actions to trigger loop detection
      const actions = Array(8).fill('scroll_down');

      let lastResult;
      for (const action of actions) {
        lastResult = await engine.processTraceUpdate(action);
      }

      expect(lastResult?.intervention_required).toBe(true);
      expect(lastResult?.loop_detected?.detected).toBe(true);
      expect(lastResult?.explanation).toBeDefined();

      const status = engine.getMonitoringStatus();
      expect(status.intervention_count).toBeGreaterThan(0);
    });
  });

  describe('enriched trace functionality', () => {
    it('should provide enriched trace with recent actions', async () => {
      await engine.startMonitoring('Test goal');
      await engine.processTraceUpdate('action1');
      await engine.processTraceUpdate('action2');

      const enrichedTrace = engine.getEnrichedCurrentTrace();

      expect(enrichedTrace.recent_actions).toEqual(['action1', 'action2']);
      expect(enrichedTrace.last_action).toBe('action2');
      expect(enrichedTrace.goal).toBe('Test goal');
    });
  });

  describe('case-based reasoning integration', () => {
    it('should retrieve similar cases', async () => {
      const cases = await engine.getSimilarCases('test problem');
      expect(Array.isArray(cases)).toBe(true);
    });

    it('should retrieve similar cases with filters', async () => {
      const filters = {
        context_filter: 'test context',
        difficulty_filter: 'medium' as const,
        outcome_filter: true,
        min_similarity: 0.5,
      };

      const cases = await engine.getSimilarCases('test problem', 3, filters);
      expect(Array.isArray(cases)).toBe(true);
      expect(cases.length).toBeLessThanOrEqual(3);
    });
  });

  describe('intervention explanations', () => {
    it('should generate intervention explanations', async () => {
      await engine.startMonitoring('Test goal');

      // Create a pattern that should trigger intervention
      const repeatedActions = Array(6).fill('same_action');

      let result;
      for (const action of repeatedActions) {
        result = await engine.processTraceUpdate(action);
      }

      if (result?.intervention_required) {
        expect(result.explanation).toContain('confidence');
        expect(result.explanation).toContain('Intervention required');
      }
    });
  });

  describe('window size handling', () => {
    it('should respect custom window size', async () => {
      await engine.startMonitoring('Test goal');

      const result = await engine.processTraceUpdate('test_action', 'context', 'goal', 15);

      expect(result).toBeDefined();
      // Window size is passed to internal methods, hard to test directly
      // but we can verify the method accepts the parameter
    });
  });

  describe('error handling', () => {
    it('should handle semantic analyzer initialization', async () => {
      await expect(engine.ensureSemanticAnalyzerReady()).resolves.not.toThrow();
    });

    it('should handle empty actions gracefully', async () => {
      await engine.startMonitoring('Test goal');

      const result = await engine.processTraceUpdate('');
      expect(result.intervention_required).toBe(false);
    });
  });
});
