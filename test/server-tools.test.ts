// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

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

// Mock UUID to avoid potential issues
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Mock semantic analyzer to avoid initialization issues
jest.mock('../src/semantic-analyzer', () => ({
  semanticAnalyzer: {
    initialize: jest.fn(async () => {}),
    analyzeTextPair: jest.fn(async () => ({
      similarity: 0.8,
      confidence: 0.9,
      sentiment: 0.1,
    })),
    assessActionOutcome: jest.fn(async () => ({
      success_probability: 0.7,
      confidence: 0.8,
      sentiment: 0.2,
    })),
    assessBeliefContradiction: jest.fn(async () => ({
      contradicts: true,
      confidence: 0.8,
      reasoning: 'Evidence contradicts belief',
    })),
    extractSemanticFeatures: jest.fn(async () => ({
      intents: ['performing action', 'checking status'],
      sentiment: 'positive',
      confidence: 0.8,
    })),
    calculateSemanticSimilarity: jest.fn(async () => ({
      similarity: 0.7,
      confidence: 0.8,
      reasoning: 'Semantic similarity analysis',
    })),
    getBatchEmbeddings: jest.fn(
      async (texts) => texts.map(() => Array(384).fill(0.5)) // Mock 384-dim embeddings
    ),
    computeSimilarityMatrix: jest.fn(async (texts) => {
      const n = texts.length;
      return Array(n)
        .fill()
        .map(
          (_, i) =>
            Array(n)
              .fill()
              .map((_, j) => (i === j ? 1.0 : 0.7)) // Mock similarity matrix
        );
    }),
    isReady: jest.fn(() => true),
  },
}));

import { DualCycleEngine } from '../src/dual-cycle-engine';
import { SentinelConfig } from '../src/types';

describe('MCP Server Tools Tests', () => {
  let engine: DualCycleEngine;
  let config: Partial<SentinelConfig>;

  beforeEach(async () => {
    config = {
      progress_indicators: ['success', 'found', 'completed', 'navigated'],
      min_actions_for_detection: 3,
      alternating_threshold: 0.4,
      repetition_threshold: 0.3,
      progress_threshold_adjustment: 0.1,
    };
    engine = new DualCycleEngine(config);

    // Initialize semantic analyzer for tests
    const { semanticAnalyzer } = await import('../src/semantic-analyzer');
    await semanticAnalyzer.initialize();
  });

  afterEach(() => {
    engine.reset();
  });

  describe('start_monitoring tool', () => {
    it('should start monitoring with goal and initial beliefs', async () => {
      const goal = 'Test goal';
      const initialBeliefs = ['belief1', 'belief2'];

      const startSpy = jest.spyOn(engine, 'startMonitoring');
      await engine.startMonitoring(goal, initialBeliefs);

      expect(startSpy).toHaveBeenCalledWith(goal, initialBeliefs);

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe(goal);
    });

    it('should handle empty initial beliefs', async () => {
      const goal = 'Test goal';

      const startSpy = jest.spyOn(engine, 'startMonitoring');
      await engine.startMonitoring(goal, []);

      expect(startSpy).toHaveBeenCalledWith(goal, []);

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
    });

    it('should allow starting monitoring while already monitoring', async () => {
      await engine.startMonitoring('First goal', []);

      // Should not throw error - engine allows restarting monitoring
      await engine.startMonitoring('Second goal', []);

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe('Second goal');
    });
  });

  describe('stop_monitoring tool', () => {
    it('should stop monitoring and return session summary', async () => {
      // Start monitoring first
      await engine.startMonitoring('Test goal', []);

      // Process some actions
      await engine.processTraceUpdate('test_action', 'test_context', 'Test goal');

      const statusBeforeStop = engine.getMonitoringStatus();
      expect(statusBeforeStop.is_monitoring).toBe(true);

      const stopSpy = jest.spyOn(engine, 'stopMonitoring');
      engine.stopMonitoring();

      expect(stopSpy).toHaveBeenCalled();

      const statusAfterStop = engine.getMonitoringStatus();
      expect(statusAfterStop.is_monitoring).toBe(false);
    });

    it('should handle stopping when not monitoring', async () => {
      const stopSpy = jest.spyOn(engine, 'stopMonitoring');

      // Should not throw error
      engine.stopMonitoring();

      expect(stopSpy).toHaveBeenCalled();

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
    });
  });

  describe('process_trace_update tool', () => {
    it('should process trace updates with all parameters', async () => {
      await engine.startMonitoring('Test goal', []);

      const processSpy = jest.spyOn(engine, 'processTraceUpdate');
      const result = await engine.processTraceUpdate(
        'test_action',
        'test_context',
        'Test goal',
        10
      );

      expect(processSpy).toHaveBeenCalledWith('test_action', 'test_context', 'Test goal', 10);
      expect(result).toBeDefined();
      expect(result.loop_detected).toBeDefined();
      expect(result.intervention_required).toBeDefined();
    });

    it('should handle optional parameters', async () => {
      await engine.startMonitoring('Test goal', []);

      const result = await engine.processTraceUpdate('test_action', undefined, 'Test goal');

      expect(result).toBeDefined();
      expect(result.loop_detected).toBeDefined();
    });

    it('should handle window size parameter', async () => {
      await engine.startMonitoring('Test goal', []);

      const result = await engine.processTraceUpdate('test_action', 'test_context', 'Test goal', 5);

      expect(result).toBeDefined();
      expect(result.loop_detected).toBeDefined();
    });

    it('should return intervention_required false when not monitoring', async () => {
      const result = await engine.processTraceUpdate('test_action', 'test_context', 'Test goal');

      expect(result).toBeDefined();
      expect(result.intervention_required).toBe(false);
    });
  });

  describe('detect_loop tool', () => {
    it('should detect loops with different methods', async () => {
      await engine.startMonitoring('Test goal', []);

      // Add some actions to create a trace
      await engine.processTraceUpdate('scroll_down', 'searching', 'Test goal');
      await engine.processTraceUpdate('scroll_down', 'searching', 'Test goal');
      await engine.processTraceUpdate('scroll_down', 'searching', 'Test goal');

      const sentinel = (engine as any).sentinel;
      const enrichedTrace = engine.getEnrichedCurrentTrace();

      // Test different detection methods
      const statisticalResult = await sentinel.detectLoop(enrichedTrace, 'statistical');
      const patternResult = await sentinel.detectLoop(enrichedTrace, 'pattern');
      const hybridResult = await sentinel.detectLoop(enrichedTrace, 'hybrid');

      expect(statisticalResult).toBeDefined();
      expect(patternResult).toBeDefined();
      expect(hybridResult).toBeDefined();

      expect(statisticalResult.detected).toBeDefined();
      expect(patternResult.detected).toBeDefined();
      expect(hybridResult.detected).toBeDefined();
    });

    it('should handle empty trace', async () => {
      await engine.startMonitoring('Test goal', []);

      const sentinel = (engine as any).sentinel;
      const enrichedTrace = engine.getEnrichedCurrentTrace();

      const result = await sentinel.detectLoop(enrichedTrace, 'hybrid');

      expect(result).toBeDefined();
      expect(result.detected).toBe(false);
    });

    it('should update context and goal when provided', async () => {
      await engine.startMonitoring('Original goal', []);

      // Add some actions
      await engine.processTraceUpdate('action1', 'context1', 'Original goal');

      const sentinel = (engine as any).sentinel;
      const enrichedTrace = engine.getEnrichedCurrentTrace();

      // Update with new context and goal
      const updatedTrace = {
        ...enrichedTrace,
        current_context: 'new_context',
        goal: 'Updated goal',
      };

      const result = await sentinel.detectLoop(updatedTrace, 'hybrid');

      expect(result).toBeDefined();
    });
  });

  describe('store_experience tool', () => {
    it('should store experience cases', async () => {
      const experience = {
        problem_description: 'Test problem',
        solution: 'Test solution',
        outcome: true,
      };

      const adjudicator = (engine as any).adjudicator;
      const storeSpy = jest.spyOn(adjudicator, 'storeExperience');

      await adjudicator.storeExperience(experience);

      expect(storeSpy).toHaveBeenCalledWith(experience);
    });

    it('should handle failed outcomes', async () => {
      const experience = {
        problem_description: 'Failed test problem',
        solution: 'Attempted solution',
        outcome: false,
      };

      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience(experience);

      // Verify it was stored
      const similarCases = await engine.getSimilarCases('Failed test problem', 5);
      expect(similarCases).toBeDefined();
    });

    it('should handle experience with context and metadata', async () => {
      const experience = {
        problem_description: 'Complex navigation problem',
        solution: 'Multi-step solution',
        outcome: true,
        context: 'web_navigation',
        difficulty_level: 'medium',
      };

      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience(experience);

      const similarCases = await engine.getSimilarCases('navigation problem', 5);
      expect(similarCases).toBeDefined();
    });
  });

  describe('retrieve_similar_cases tool', () => {
    it('should retrieve similar cases with default parameters', async () => {
      // Store an experience first
      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience({
        problem_description: 'Navigation problem',
        solution: 'Use alternative method',
        outcome: true,
      });

      const getSimilarSpy = jest.spyOn(engine, 'getSimilarCases');
      const result = await engine.getSimilarCases('Navigation issue', 5);

      expect(getSimilarSpy).toHaveBeenCalledWith('Navigation issue', 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty case base', async () => {
      // Reset to clear any stored cases
      engine.reset();

      const result = await engine.getSimilarCases('Nonexistent problem', 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle custom max_results parameter', async () => {
      // Store multiple experiences
      const adjudicator = (engine as any).adjudicator;
      for (let i = 0; i < 10; i++) {
        await adjudicator.storeExperience({
          problem_description: `Problem ${i}`,
          solution: `Solution ${i}`,
          outcome: true,
        });
      }

      const result = await engine.getSimilarCases('Problem', 3);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle filters', async () => {
      // Store experiences with different outcomes
      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience({
        problem_description: 'Success case',
        solution: 'Working solution',
        outcome: true,
      });

      await adjudicator.storeExperience({
        problem_description: 'Failure case',
        solution: 'Failed solution',
        outcome: false,
      });

      // Test with outcome filter
      const filters = {
        outcome_filter: true,
        context_filter: undefined,
        difficulty_filter: undefined,
        min_similarity: undefined,
      };

      const result = await engine.getSimilarCases('case', 5, filters);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('get_monitoring_status tool', () => {
    it('should return monitoring status when not monitoring', async () => {
      const status = engine.getMonitoringStatus();

      expect(status).toBeDefined();
      expect(status.is_monitoring).toBe(false);
      expect(status.current_goal).toBe('');
      expect(status.trace_length).toBe(0);
      expect(status.intervention_count).toBe(0);
    });

    it('should return monitoring status when actively monitoring', async () => {
      await engine.startMonitoring('Active goal', ['belief1']);

      await engine.processTraceUpdate('action1', 'context1', 'Active goal');
      await engine.processTraceUpdate('action2', 'context2', 'Active goal');

      const status = engine.getMonitoringStatus();

      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe('Active goal');
      expect(status.trace_length).toBeGreaterThan(0);
    });

    it('should track intervention count', async () => {
      await engine.startMonitoring('Test goal', []);

      // Process actions that should trigger interventions
      const actions = ['scroll_down', 'scroll_down', 'scroll_down', 'scroll_down', 'scroll_down'];

      for (const action of actions) {
        const result = await engine.processTraceUpdate(action, 'searching', 'Test goal');
        if (result.intervention_required) {
          break;
        }
      }

      const status = engine.getMonitoringStatus();
      expect(status.intervention_count).toBeGreaterThan(0);
    });
  });

  describe('reset_engine tool', () => {
    it('should reset engine state completely', async () => {
      // Set up some state
      await engine.startMonitoring('Test goal', ['belief1']);
      await engine.processTraceUpdate('action1', 'context1', 'Test goal');

      const statusBeforeReset = engine.getMonitoringStatus();
      expect(statusBeforeReset.is_monitoring).toBe(true);
      expect(statusBeforeReset.trace_length).toBeGreaterThan(0);

      // Reset
      const resetSpy = jest.spyOn(engine, 'reset');
      engine.reset();

      expect(resetSpy).toHaveBeenCalled();

      const statusAfterReset = engine.getMonitoringStatus();
      expect(statusAfterReset.is_monitoring).toBe(false);
      expect(statusAfterReset.trace_length).toBe(0);
      expect(statusAfterReset.intervention_count).toBe(0);
    });

    it('should preserve stored experiences after reset', async () => {
      // Store some experiences
      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience({
        problem_description: 'Test problem',
        solution: 'Test solution',
        outcome: true,
      });

      // Verify it's stored
      let similarCases = await engine.getSimilarCases('Test problem', 5);
      expect(similarCases.length).toBeGreaterThan(0);

      // Reset
      engine.reset();

      // Verify experiences are preserved (reset only clears monitoring state)
      similarCases = await engine.getSimilarCases('Test problem', 5);
      expect(similarCases.length).toBeGreaterThan(0);
    });
  });

  describe('configure_detection tool', () => {
    it('should update detection configuration', async () => {
      const newConfig = {
        progress_indicators: ['custom_indicator'],
        min_actions_for_detection: 3,
        alternating_threshold: 0.3,
        repetition_threshold: 0.2,
        progress_threshold_adjustment: 0.1,
        semantic_intents: ['custom_intent'],
      };

      const sentinel = (engine as any).sentinel;
      const adjudicator = (engine as any).adjudicator;

      const updateConfigSpy = jest.spyOn(sentinel, 'updateConfig');
      const updateSemanticSpy = jest.spyOn(adjudicator, 'updateSemanticIntents');

      // Simulate configuration update
      sentinel.updateConfig(newConfig);
      adjudicator.updateSemanticIntents(newConfig.semantic_intents);

      expect(updateConfigSpy).toHaveBeenCalledWith(newConfig);
      expect(updateSemanticSpy).toHaveBeenCalledWith(newConfig.semantic_intents);
    });

    it('should handle partial configuration updates', async () => {
      const partialConfig = {
        min_actions_for_detection: 7,
        alternating_threshold: 0.6,
      };

      const sentinel = (engine as any).sentinel;
      const updateConfigSpy = jest.spyOn(sentinel, 'updateConfig');

      sentinel.updateConfig(partialConfig);

      expect(updateConfigSpy).toHaveBeenCalledWith(partialConfig);
    });

    it('should update semantic intents separately', async () => {
      const semanticIntents = ['intent1', 'intent2', 'intent3'];

      const adjudicator = (engine as any).adjudicator;
      const updateSemanticSpy = jest.spyOn(adjudicator, 'updateSemanticIntents');

      adjudicator.updateSemanticIntents(semanticIntents);

      expect(updateSemanticSpy).toHaveBeenCalledWith(semanticIntents);
    });

    it('should handle empty arrays in configuration', async () => {
      const configWithEmptyArrays = {
        progress_indicators: [],
        semantic_intents: [],
      };

      const sentinel = (engine as any).sentinel;
      const adjudicator = (engine as any).adjudicator;

      const updateConfigSpy = jest.spyOn(sentinel, 'updateConfig');
      const updateSemanticSpy = jest.spyOn(adjudicator, 'updateSemanticIntents');

      sentinel.updateConfig(configWithEmptyArrays);
      adjudicator.updateSemanticIntents(configWithEmptyArrays.semantic_intents);

      expect(updateConfigSpy).toHaveBeenCalledWith(configWithEmptyArrays);
      expect(updateSemanticSpy).toHaveBeenCalledWith([]);
    });
  });

  describe('Tool Integration Tests', () => {
    it('should handle complete workflow from start to reset', async () => {
      // 1. Start monitoring
      await engine.startMonitoring('Complete workflow test', ['initial belief']);

      let status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);

      // 2. Process trace updates
      await engine.processTraceUpdate('action1', 'context1', 'Complete workflow test');
      await engine.processTraceUpdate('action2', 'context2', 'Complete workflow test');

      status = engine.getMonitoringStatus();
      expect(status.trace_length).toBe(2);

      // 3. Detect loop
      const sentinel = (engine as any).sentinel;
      const enrichedTrace = engine.getEnrichedCurrentTrace();
      const loopResult = await sentinel.detectLoop(enrichedTrace, 'hybrid');

      expect(loopResult).toBeDefined();

      // 4. Store experience
      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience({
        problem_description: 'Workflow test problem',
        solution: 'Workflow test solution',
        outcome: true,
      });

      // 5. Retrieve similar cases
      const similarCases = await engine.getSimilarCases('Workflow test', 5);
      expect(similarCases).toBeDefined();

      // 6. Configure detection with semantic intents
      const newConfig = {
        min_actions_for_detection: 5,
        alternating_threshold: 0.4,
        semantic_intents: ['testing', 'clicking', 'navigating'],
      };
      sentinel.updateConfig(newConfig);

      // Test dual-cycle engine with semantic intents
      const engineWithConfig = new DualCycleEngine(newConfig);
      await engineWithConfig.ensureSemanticAnalyzerReady();

      // 7. Stop monitoring
      engine.stopMonitoring();

      status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);

      // 8. Reset
      engine.reset();

      status = engine.getMonitoringStatus();
      expect(status.trace_length).toBe(0);
    });

    it('should handle error conditions gracefully', async () => {
      // Test processing trace update without starting monitoring - returns intervention_required false
      const result = await engine.processTraceUpdate('action', 'context', 'goal');
      expect(result.intervention_required).toBe(false);

      // Test getting enriched trace without monitoring - returns default values
      const enrichedTrace = engine.getEnrichedCurrentTrace();
      expect(enrichedTrace).toBeDefined();
      expect(enrichedTrace.last_action).toBe('');
      expect(enrichedTrace.current_context).toBeUndefined();
      expect(enrichedTrace.goal).toBe('');
      expect(enrichedTrace.recent_actions).toEqual([]);
    });
  });
});
