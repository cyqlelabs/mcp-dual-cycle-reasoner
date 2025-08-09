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
import { CognitiveTrace, SentinelConfig } from '../src/types';

// Load test fixtures
const loadFixture = (filename: string) => {
  const fixturePath = join(__dirname, 'fixtures', filename);
  return JSON.parse(readFileSync(fixturePath, 'utf-8'));
};

const complexScenarioFixture = loadFixture('browser_use_complex_scenario.json');
const loopFixture = loadFixture('browser_use_loop_fixture.json');
const scrollFixture = loadFixture('browser_use_scroll_fixture.json');

describe('DualCycleEngine with Fixtures', () => {
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

  describe('Complex Scenario Fixture Tests', () => {
    it('should successfully process complex scenario trace and detect state invariance', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Start monitoring
      await engine.startMonitoring(trace.goal, []);

      // Process the trace actions one by one
      let result: any = { intervention_required: false, loop_detected: { detected: false } };
      for (const action of trace.recent_actions) {
        result = await engine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Break if intervention is required
        if (result.intervention_required) {
          break;
        }
      }
      // If no actions were processed, use the default result
      if (trace.recent_actions.length === 0) {
        result = { intervention_required: false, loop_detected: { detected: false } };
      }

      expect(result).toBeDefined();
      // The complex scenario should trigger loop detection due to repetitive actions
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);

      // Verify monitoring status
      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe(trace.goal);
      // The trace length will be shorter due to early loop detection
      expect(status.trace_length).toBeLessThanOrEqual(trace.recent_actions.length);
      expect(status.trace_length).toBeGreaterThan(0);
    });

    it('should detect progress indicators in complex scenario', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Configure with specific progress indicators
      const progressConfig = {
        ...config,
        progress_indicators: ['click_element_by_index', 'extract_structured_data'],
      };

      const progressEngine = new DualCycleEngine(progressConfig);
      await progressEngine.startMonitoring(trace.goal, []);

      // Process the trace actions one by one
      let result;
      for (const action of trace.recent_actions) {
        result = await progressEngine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Break if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      // Even with progress indicators, repetitive actions should still be detected
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
    });

    it('should store and retrieve experience from complex scenario', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Store experience
      const experience = {
        problem_description: 'Finding pricing comparison table',
        solution: 'Navigate to pricing page and open comparison modal',
        outcome: true,
      };

      const adjudicator = (engine as any).adjudicator;
      await adjudicator.storeExperience(experience);

      // Retrieve similar cases
      const similarCases = await engine.getSimilarCases('pricing table comparison', 3);

      expect(similarCases).toBeDefined();
      expect(similarCases.length).toBeGreaterThan(0);
      expect(similarCases[0].problem_description).toContain('pricing');
    });
  });

  describe('Loop Detection Fixture Tests', () => {
    it('should detect loops in repetitive scrolling pattern', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      await engine.startMonitoring(trace.goal, []);

      // Process the trace with loop detection
      // Process the trace actions one by one
      let result;
      for (const action of trace.recent_actions) {
        result = await engine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Stop if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      expect(result).toBeDefined();
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.loop_detected?.type).toMatch(
        /state_invariance|action_repetition|progress_stagnation/
      );
      expect(result.loop_detected?.confidence).toBeGreaterThan(0.5);
    });

    it('should confirm browser_use_loop_fixture.json triggers loop detection', async () => {
      // This is the critical test - the loop fixture should ALWAYS trigger a loop
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      await engine.startMonitoring(trace.goal, []);
      // Process the trace actions one by one
      let result;
      for (const action of trace.recent_actions) {
        result = await engine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Stop if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      // Assert that the loop fixture definitively triggers loop detection
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.loop_detected?.confidence).toBeGreaterThan(0.5);
      expect(result.loop_detected?.details).toBeDefined();
    });

    it('should confirm complex scenario triggers state invariance detection', async () => {
      // Complex scenario should trigger state invariance detection due to repetitive actions
      const complexTrace: CognitiveTrace = complexScenarioFixture.cognitive_trace;
      await engine.startMonitoring(complexTrace.goal, []);
      // Process the trace actions one by one
      let complexResult: any = { intervention_required: false, loop_detected: { detected: false } };
      for (const action of complexTrace.recent_actions) {
        complexResult = await engine.processTraceUpdate(
          action,
          complexTrace.current_context,
          complexTrace.goal
        );
        // Break if intervention is required
        if (complexResult.intervention_required) {
          break;
        }
      }

      expect(complexResult.intervention_required).toBe(true);
      expect(complexResult.loop_detected?.detected).toBe(true);
      expect(complexResult.loop_detected?.type).toMatch(
        /state_invariance|action_repetition|progress_stagnation/
      );

      // Reset for next test
      engine.reset();

      // Scroll fixture should trigger loop detection due to repetitive scroll_down actions
      const scrollTrace: CognitiveTrace = scrollFixture.cognitive_trace;
      await engine.startMonitoring(scrollTrace.goal, []);
      // Process the trace actions one by one
      let scrollResult: any = { intervention_required: false, loop_detected: { detected: false } };
      for (const action of scrollTrace.recent_actions) {
        scrollResult = await engine.processTraceUpdate(
          action,
          scrollTrace.current_context,
          scrollTrace.goal
        );
        // Break if intervention is required
        if (scrollResult.intervention_required) {
          break;
        }
      }

      expect(scrollResult.intervention_required).toBe(true);
      expect(scrollResult.loop_detected?.detected).toBe(true);
    });

    it('should use hybrid detection method for loop fixture', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      const sentinel = (engine as any).sentinel;
      const loopResult = await sentinel.detectLoop(trace, 'hybrid');

      expect(loopResult.detected).toBe(true);
      expect(loopResult.type).toBe('progress_stagnation');
      expect(loopResult.details.metrics.diversity).toBeDefined();
      expect(loopResult.actions_involved).toBeDefined();
      expect(loopResult.actions_involved!.length).toBeGreaterThan(0);
      expect(loopResult.actions_involved).toEqual(
        expect.arrayContaining(['scroll_down', 'scroll_up'])
      );
    });

    it('should detect loop and retrieve similar cases for recovery', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      const sentinel = (engine as any).sentinel;
      const adjudicator = (engine as any).adjudicator;

      // Detect loop
      const loopResult = await sentinel.detectLoop(trace, 'hybrid');

      expect(loopResult).toBeDefined();
      expect(loopResult.detected).toBe(true);
      expect(loopResult.confidence).toBeGreaterThan(0);

      // Store a related experience case
      const experience = {
        problem_description: 'Stuck in scrolling loop trying to find element',
        solution: 'Use alternative navigation method',
        outcome: true,
      };

      await adjudicator.storeExperience(experience);

      // Retrieve similar cases for recovery
      const similarCases = await engine.getSimilarCases('scrolling loop navigation', 3);

      expect(similarCases).toBeDefined();
      expect(similarCases.length).toBeGreaterThan(0);
      expect(similarCases[0].problem_description).toContain('scrolling');
    });

    it('should handle recovery outcome updates', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      await engine.startMonitoring(trace.goal, []);
      // Process the trace actions one by one
      for (const action of trace.recent_actions) {
        await engine.processTraceUpdate(action, trace.current_context, trace.goal);
      }

      const status = engine.getMonitoringStatus();
      expect(status.intervention_count).toBeGreaterThan(0);
    });
  });

  describe('Scroll Fixture Tests', () => {
    it('should handle successful scroll-to-find pattern', async () => {
      const trace: CognitiveTrace = scrollFixture.cognitive_trace;

      await engine.startMonitoring(trace.goal, []);

      // Process the trace actions one by one
      let result;
      for (const action of trace.recent_actions) {
        result = await engine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Stop if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      expect(result).toBeDefined();
      // The scroll pattern with repetitive actions should trigger loop detection
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
    });

    it('should detect successful task completion pattern', async () => {
      const trace: CognitiveTrace = scrollFixture.cognitive_trace;

      // Configure with click success indicator
      const successConfig = {
        ...config,
        progress_indicators: ['click_element_by_index'],
      };

      const successEngine = new DualCycleEngine(successConfig);
      await successEngine.startMonitoring(trace.goal, []);

      // Process the trace actions one by one
      let result;
      for (const action of trace.recent_actions) {
        result = await successEngine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Break if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      // Even with progress indicators, repetitive actions should still be detected
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
    });

    it('should perform statistical analysis on scroll pattern', async () => {
      const trace: CognitiveTrace = scrollFixture.cognitive_trace;

      const sentinel = (engine as any).sentinel;
      const loopResult = sentinel.detectLoop(trace, 'statistical');

      expect(loopResult).toBeDefined();
      expect(loopResult).toBeDefined();
      if (loopResult.statistical_metrics) {
        expect(loopResult.statistical_metrics.entropy_score).toBeDefined();
        expect(loopResult.statistical_metrics.variance_score).toBeDefined();
      }
    });
  });

  describe('Configuration Tests', () => {
    it('should handle different detection thresholds', async () => {
      const strictConfig = {
        ...config,
        alternating_threshold: 0.2,
        repetition_threshold: 0.1,
      };

      const strictEngine = new DualCycleEngine(strictConfig);
      await strictEngine.startMonitoring(loopFixture.cognitive_trace.goal, []);

      // Process the trace actions one by one
      let result;
      for (const action of loopFixture.cognitive_trace.recent_actions) {
        result = await strictEngine.processTraceUpdate(
          action,
          loopFixture.cognitive_trace.current_context,
          loopFixture.cognitive_trace.goal
        );
        // Stop if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.confidence).toBeGreaterThan(0.5);
    });

    it('should adjust thresholds based on progress indicators', async () => {
      const progressConfig = {
        ...config,
        progress_indicators: ['found_element', 'click_success'],
        progress_threshold_adjustment: 0.5,
        min_actions_for_detection: 3,
      };

      const progressEngine = new DualCycleEngine(progressConfig);

      // Test with trace that has progress indicators and varying context
      const progressTrace: CognitiveTrace = {
        recent_actions: ['scroll_down', 'found_element', 'click_success'],
        current_context: 'different_context',
        goal: 'Find and click button',
      };

      // Process actions with different contexts to avoid state invariance
      const contexts = ['searching', 'found_target', 'clicking'];

      await progressEngine.startMonitoring(progressTrace.goal, []);
      // Process the trace actions one by one with different contexts
      let result;
      for (let i = 0; i < progressTrace.recent_actions.length; i++) {
        const action = progressTrace.recent_actions[i];
        const context = contexts[i] || contexts[contexts.length - 1];
        result = await progressEngine.processTraceUpdate(action, context, progressTrace.goal);
        // Break if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      // With proper progress indicators, this sequence should NOT trigger loop detection
      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected?.detected).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from monitoring to recovery', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      // Start monitoring
      await engine.startMonitoring(trace.goal, ['Button should be visible', 'Page loads quickly']);

      // Process trace and detect loop
      // Process the trace actions one by one
      let result;
      for (const action of trace.recent_actions) {
        result = await engine.processTraceUpdate(action, trace.current_context, trace.goal);
        // Stop if intervention is required
        if (result.intervention_required) {
          break;
        }
      }

      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.explanation).toBeDefined();

      const status = engine.getMonitoringStatus();
      expect(status.intervention_count).toBe(1);
    });

    it('should maintain session state across multiple trace updates', async () => {
      const scrollTrace: CognitiveTrace = scrollFixture.cognitive_trace;

      await engine.startMonitoring(scrollTrace.goal, []);

      // Process partial trace
      const partialTrace = {
        ...scrollTrace,
        recent_actions: scrollTrace.recent_actions.slice(0, 2),
      };

      // Process the trace actions one by one
      let result1: any = { intervention_required: false, loop_detected: { detected: false } };
      for (const action of partialTrace.recent_actions) {
        result1 = await engine.processTraceUpdate(
          action,
          partialTrace.current_context,
          partialTrace.goal
        );
        if (result1.intervention_required) {
          break;
        }
      }
      // First 2 actions might trigger loop if they're repetitive
      expect(result1).toBeDefined();

      // Process remaining actions (not the full trace, just the remaining ones)
      const remainingActions = scrollTrace.recent_actions.slice(2);
      let result2: any = result1;
      for (const action of remainingActions) {
        result2 = await engine.processTraceUpdate(
          action,
          scrollTrace.current_context,
          scrollTrace.goal
        );
        if (result2.intervention_required) {
          break;
        }
      }
      // Final state should be intervention required due to accumulated repetitive actions
      expect(result2).toBeDefined();
      expect(result2.intervention_required).toBe(true);

      const status = engine.getMonitoringStatus();
      expect(status.trace_length).toBeLessThanOrEqual(scrollTrace.recent_actions.length);
      expect(status.trace_length).toBeGreaterThan(0);
    });

    it('should reset engine state properly', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Process some data
      await engine.startMonitoring(trace.goal, ['Initial belief']);
      // Process the trace actions one by one
      for (const action of trace.recent_actions) {
        await engine.processTraceUpdate(action, trace.current_context, trace.goal);
      }

      // Reset engine
      engine.reset();

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
      expect(status.trace_length).toBe(0);
      expect(status.intervention_count).toBe(0);
    });
  });

  describe('Actions Accumulation Tests', () => {
    it('should accumulate actions through complete monitoring workflow', async () => {
      const goal = 'Find and click download button';
      const initialBeliefs = ['Download button is visible on page'];

      // Step 1: Start monitoring
      await engine.startMonitoring(goal, initialBeliefs);

      let status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
      expect(status.trace_length).toBe(0);

      // Step 2: Add multiple actions via process_trace_update
      const actions = ['scroll_down', 'scroll_down', 'scroll_down', 'scroll_down', 'scroll_down'];

      const context = 'Looking for download button';
      let finalResult;

      for (const action of actions) {
        finalResult = await engine.processTraceUpdate(action, context, goal);

        // Check that trace length increases with each action
        status = engine.getMonitoringStatus();
        expect(status.trace_length).toBeGreaterThan(0);

        // If loop is detected, break early
        if (finalResult.intervention_required) {
          break;
        }
      }

      // Verify actions were accumulated
      status = engine.getMonitoringStatus();
      expect(status.trace_length).toBeGreaterThan(0);
      expect(status.trace_length).toBeLessThanOrEqual(actions.length);

      // Step 3: Call detect_loop to interpret accumulated actions
      const sentinel = (engine as any).sentinel;
      const enrichedTrace = engine.getEnrichedCurrentTrace();

      expect(enrichedTrace).toBeDefined();
      expect(enrichedTrace.recent_actions).toBeDefined();
      expect(enrichedTrace.recent_actions.length).toBeGreaterThan(0);

      const loopResult = await sentinel.detectLoop(enrichedTrace, 'hybrid');

      expect(loopResult).toBeDefined();
      expect(loopResult.detected).toBe(true);
      expect(loopResult.type).toBeDefined();
      expect(loopResult.confidence).toBeGreaterThan(0);

      // Verify the accumulated actions triggered loop detection
      expect(finalResult.intervention_required).toBe(true);
      expect(finalResult.loop_detected?.detected).toBe(true);

      // Step 4: Stop monitoring
      engine.stopMonitoring();

      status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
    });

    it('should verify individual action accumulation during monitoring', async () => {
      const goal = 'Navigate to pricing page';

      // Start monitoring
      await engine.startMonitoring(goal, []);

      const testActions = [
        'click_element_by_index',
        'wait_for_page_load',
        'scroll_down',
        'click_element_by_index',
        'wait_for_page_load',
        'scroll_down',
      ];

      const contexts = [
        'Clicked navigation link',
        'Waiting for page to load',
        'Scrolling to find pricing',
        'Clicked pricing tab',
        'Waiting for content',
        'Scrolling for more details',
      ];

      // Process each action and verify accumulation
      for (let i = 0; i < testActions.length; i++) {
        const action = testActions[i];
        const context = contexts[i];

        const result = await engine.processTraceUpdate(action, context, goal);

        // Verify trace length increases
        const status = engine.getMonitoringStatus();
        expect(status.trace_length).toBe(i + 1);

        // Verify current trace contains all actions up to this point
        const enrichedTrace = engine.getEnrichedCurrentTrace();
        expect(enrichedTrace.recent_actions).toBeDefined();
        expect(enrichedTrace.recent_actions.length).toBe(i + 1);
        expect(enrichedTrace.recent_actions[i]).toBe(action);

        // If intervention is required, break
        if (result.intervention_required) {
          break;
        }
      }

      // Final verification
      const finalStatus = engine.getMonitoringStatus();
      expect(finalStatus.trace_length).toBeGreaterThan(0);
      expect(finalStatus.trace_length).toBeLessThanOrEqual(testActions.length);

      engine.stopMonitoring();
    });
  });
});
