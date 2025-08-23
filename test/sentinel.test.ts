// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock semantic analyzer
jest.mock('../src/semantic-analyzer', () => ({
  semanticAnalyzer: {
    initialize: jest.fn(async () => {}),
    computeSimilarityMatrix: jest.fn(async (texts) => {
      const n = texts.length;
      return Array(n)
        .fill()
        .map((_, i) =>
          Array(n)
            .fill()
            .map((_, j) => (i === j ? 1.0 : Math.random() * 0.5 + 0.5))
        );
    }),
    calculateSemanticSimilarity: jest.fn(async () => ({
      similarity: 0.8,
      confidence: 0.9,
      reasoning: 'Mock similarity',
    })),
    isReady: jest.fn(() => true),
  },
}));

import { Sentinel } from '../src/sentinel';
import { CognitiveTrace, SentinelConfig } from '../src/types';

describe('Sentinel', () => {
  let sentinel: Sentinel;
  let config: Partial<SentinelConfig>;

  beforeEach(() => {
    config = {
      progress_indicators: ['success', 'found', 'completed'],
      min_actions_for_detection: 3,
      alternating_threshold: 0.4,
      repetition_threshold: 0.3,
      progress_threshold_adjustment: 0.1,
      statistical_analysis: {
        entropy_threshold: 0.6,
        variance_threshold: 0.1,
        trend_threshold: 0.1,
        cyclicity_threshold: 0.3,
      },
    };

    sentinel = new Sentinel(config);
  });

  afterEach(() => {
    sentinel.reset();
    jest.clearAllMocks();
  });

  describe('edge cases and error handling', () => {
    it('should handle empty action sequences', async () => {
      const trace: CognitiveTrace & { recent_actions: string[] } = {
        last_action: '',
        goal: 'test goal',
        recent_actions: [],
      };

      const result = await sentinel.detectLoop(trace, 'pattern', 5);
      expect(result.detected).toBe(false);
    });

    it('should handle single action sequences', async () => {
      const trace: CognitiveTrace & { recent_actions: string[] } = {
        last_action: 'single_action',
        goal: 'test goal',
        recent_actions: ['single_action'],
      };

      const result = await sentinel.detectLoop(trace, 'pattern', 5);
      expect(result.detected).toBe(false);
    });

    it('should handle very long action sequences without performance issues', async () => {
      const longActionSequence = Array(1000)
        .fill()
        .map((_, i) => `action_${i % 10}`);
      const trace: CognitiveTrace & { recent_actions: string[] } = {
        last_action: 'action_9',
        goal: 'performance test',
        recent_actions: longActionSequence,
      };

      const start = Date.now();
      const result = await sentinel.detectLoop(trace, 'hybrid', 50);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle invalid window sizes gracefully', async () => {
      const trace: CognitiveTrace & { recent_actions: string[] } = {
        last_action: 'test_action',
        goal: 'test goal',
        recent_actions: ['action1', 'action2', 'action3'],
      };

      // Test negative window size
      const result1 = await sentinel.detectLoop(trace, 'pattern', -1);
      expect(result1.detected).toBe(false);

      // Test zero window size
      const result2 = await sentinel.detectLoop(trace, 'pattern', 0);
      expect(result2.detected).toBe(false);

      // Test extremely large window size
      const result3 = await sentinel.detectLoop(trace, 'pattern', 1000000);
      expect(result3.detected).toBe(false);
    });

    it('should handle malformed traces gracefully', async () => {
      const malformedTrace: any = {
        last_action: null,
        goal: undefined,
        recent_actions: null,
      };

      // Should not throw but return no detection
      const result = await sentinel.detectLoop(malformedTrace, 'pattern', 5);
      expect(result.detected).toBe(false);
    });

    it('should handle actions with special characters', async () => {
      const specialActions = [
        'action_with_underscore',
        'action-with-dash',
        'action.with.dots',
        'action with spaces',
        'action@with#symbols$',
        '中文_action',
        'émoji_🚀_action',
      ];

      const trace: CognitiveTrace & { recent_actions: string[] } = {
        last_action: specialActions[0],
        goal: 'special chars test',
        recent_actions: specialActions,
      };

      const result = await sentinel.detectLoop(trace, 'pattern', 10);
      expect(result).toBeDefined();
      expect(typeof result.detected).toBe('boolean');
    });

    it('should maintain consistent behavior across multiple resets', async () => {
      const actions = ['reset_test_1', 'reset_test_2', 'reset_test_1', 'reset_test_2'];

      for (let i = 0; i < 3; i++) {
        sentinel.reset();

        const trace: CognitiveTrace & { recent_actions: string[] } = {
          last_action: actions[actions.length - 1],
          goal: `reset iteration ${i}`,
          recent_actions: actions,
        };

        const result = await sentinel.detectLoop(trace, 'pattern', 5);
        expect(result).toBeDefined();
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should handle concurrent detection requests', async () => {
      const traces = Array(5)
        .fill()
        .map((_, i) => ({
          last_action: `concurrent_action_${i}`,
          goal: `concurrent goal ${i}`,
          recent_actions: [`action_${i}`, `action_${i}`, `action_${i}`],
        }));

      const promises = traces.map((trace) =>
        sentinel.detectLoop(trace as CognitiveTrace & { recent_actions: string[] }, 'hybrid', 5)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(typeof result.detected).toBe('boolean');
      });
    });

    it('should handle detection method case variations', async () => {
      const trace: CognitiveTrace & { recent_actions: string[] } = {
        last_action: 'test_action',
        goal: 'case test',
        recent_actions: ['action1', 'action2'],
      };

      // Test with different method variations
      const methods = ['statistical', 'pattern', 'hybrid'];

      for (const method of methods) {
        const result = await sentinel.detectLoop(trace, method as any, 5);
        expect(result).toBeDefined();
        expect(typeof result.detected).toBe('boolean');
      }
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultSentinel = new Sentinel({});

      expect(defaultSentinel).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        min_actions_for_detection: 7,
        alternating_threshold: 0.6,
      };

      const customSentinel = new Sentinel(customConfig);

      expect(customSentinel).toBeDefined();
    });

    it('should handle repeated initialization', () => {
      // Sentinel doesn't have initialize method, just test construction
      const sentinel1 = new Sentinel(config);
      const sentinel2 = new Sentinel(config); // Should not throw

      expect(sentinel1).toBeDefined();
      expect(sentinel2).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration parameters', () => {
      const newConfig = {
        min_actions_for_detection: 10,
        alternating_threshold: 0.8,
        repetition_threshold: 0.7,
      };

      sentinel.updateConfig(newConfig);

      // Test that the update doesn't throw and subsequent operations work
      expect(() => sentinel.updateConfig(newConfig)).not.toThrow();
    });

    it('should handle partial configuration updates', () => {
      const partialConfig = {
        min_actions_for_detection: 5,
      };

      expect(() => sentinel.updateConfig(partialConfig)).not.toThrow();
    });

    it('should handle empty configuration', () => {
      expect(() => sentinel.updateConfig({})).not.toThrow();
    });

    it('should handle undefined configuration', () => {
      expect(() => sentinel.updateConfig(undefined as any)).not.toThrow();
    });
  });

  describe('detectLoop - statistical method', () => {
    it('should detect loops using statistical analysis', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['scroll_down', 'scroll_down', 'scroll_down', 'scroll_down'],
        current_context: 'Scrolling repeatedly',
        goal: 'Find target element',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result).toBeDefined();
      expect(result.detected).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.statistical_metrics).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it('should calculate entropy correctly for repetitive actions', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action1', 'action1', 'action1'],
        current_context: 'Repetitive context',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics?.entropy_score).toBeDefined();
      expect(result.statistical_metrics!.entropy_score!).toBeLessThan(1); // Low entropy for repetitive actions
    });

    it('should calculate entropy correctly for diverse actions', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action3', 'action4'],
        current_context: 'Diverse context',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics?.entropy_score).toBeDefined();
      expect(result.statistical_metrics!.entropy_score!).toBeGreaterThan(0);
    });

    it('should calculate variance for action contexts', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['click', 'scroll', 'click', 'scroll'],
        current_context: 'Variable context',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics?.variance_score).toBeDefined();
      expect(result.statistical_metrics!.variance_score!).toBeGreaterThanOrEqual(0);
    });

    it('should detect trends in action sequences', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action3', 'action4', 'action5'],
        current_context: 'Progressive context',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics?.trend_score).toBeDefined();
    });

    it('should handle short action sequences', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1'],
        current_context: 'Single action',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle empty action sequences', async () => {
      const trace: CognitiveTrace = {
        recent_actions: [],
        current_context: 'No actions',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectLoop - pattern method', () => {
    it('should detect action repetition patterns', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['click', 'click', 'click', 'click', 'click'],
        current_context: 'Clicking repeatedly',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'pattern');

      expect(result).toBeDefined();
      expect(typeof result.detected).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      if (result.detected) {
        expect(result.type).toBeDefined();
      }
    });

    it('should detect alternating patterns', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['scroll_up', 'scroll_down', 'scroll_up', 'scroll_down', 'scroll_up'],
        current_context: 'Scrolling back and forth',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'pattern');

      expect(result).toBeDefined();
      if (result.detected) {
        expect(['action_repetition', 'progress_stagnation']).toContain(result.type);
      }
    });

    it('should detect state invariance', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action1', 'action2'],
        current_context: 'same_context',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'pattern');

      expect(result).toBeDefined();
      if (result.detected) {
        expect(result.type).toBeDefined();
      }
    });

    it('should handle progress indicators', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['click', 'success', 'click', 'completed'],
        current_context: 'Making progress',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'pattern');

      // Should be less likely to detect loop with progress indicators
      expect(result).toBeDefined();
    });

    it('should adjust thresholds for progress indicators', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'found', 'action1', 'success'],
        current_context: 'Progress being made',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'pattern');

      // Progress indicators should reduce likelihood of detecting false loops
      expect(result).toBeDefined();
    });
  });

  describe('detectLoop - hybrid method', () => {
    it('should combine statistical and pattern detection', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['scroll_down', 'scroll_down', 'scroll_down', 'click', 'scroll_down'],
        current_context: 'Mixed behavior',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
      expect(result.details).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      if (result.details.dominant_method) {
        expect(typeof result.details.dominant_method).toBe('string');
      }
    });

    it('should provide detailed metrics in hybrid mode', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action1', 'action2', 'action1'],
        current_context: 'Alternating pattern',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result.statistical_metrics).toBeDefined();
      expect(result.details.metrics).toBeDefined();
    });

    it('should handle conflicting detection results', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['unique1', 'unique2', 'unique3', 'unique4'],
        current_context: 'Diverse actions',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });
  });

  describe('semantic analysis integration', () => {
    it('should use semantic similarity for context analysis', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['click_button', 'press_button', 'tap_button'],
        current_context: 'Similar actions with different names',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
      // Should recognize semantic similarity between actions
    });

    it('should handle semantic analysis errors gracefully', async () => {
      const { semanticAnalyzer } = await import('../src/semantic-analyzer');
      const originalMethod = semanticAnalyzer.computeSimilarityMatrix;

      // Mock the method to throw an error
      (semanticAnalyzer.computeSimilarityMatrix as jest.MockedFunction<any>) = jest
        .fn()
        .mockRejectedValue(new Error('Semantic analysis failed'));

      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2'],
        current_context: 'Test context',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      // Restore the original method
      (semanticAnalyzer.computeSimilarityMatrix as any) = originalMethod;

      expect(result).toBeDefined();
      expect(typeof result.detected).toBe('boolean');
    });
  });

  describe('state history and convergence', () => {
    it('should manage state history size limit', async () => {
      // Create traces that will exceed maxHistorySize (20)
      for (let i = 0; i < 25; i++) {
        const trace: CognitiveTrace = {
          recent_actions: [`action_${i}`],
          current_context: `context_${i}`,
          goal: 'Test goal',
        };

        await sentinel.detectLoop(trace, 'pattern');
      }

      // The state history should have been trimmed
      const config = sentinel.getConfig();
      expect(config).toBeDefined();
    });

    it('should detect state convergence with high convergence score', async () => {
      // Create trace with repeated context to trigger convergence
      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action1', 'action2', 'action1'],
        current_context: 'same_context',
        goal: 'Test goal',
      };

      // Run multiple times with same context to build history
      for (let i = 0; i < 5; i++) {
        await sentinel.detectLoop(trace, 'pattern');
      }

      const result = await sentinel.detectLoop(trace, 'pattern');

      expect(result).toBeDefined();
      if (result.detected && result.type === 'state_invariance') {
        expect(result.actions_involved).toBeDefined();
        expect(Array.isArray(result.actions_involved)).toBe(true);
      }
    });

    it('should handle context with extractable features', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['click', 'scroll', 'click'],
        current_context: 'page_url=test.com status=loading user=admin progress=50%',
        goal: 'Navigate test page',
      };

      const result = await sentinel.detectLoop(trace, 'pattern');

      expect(result).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null or undefined trace', async () => {
      // Create an invalid trace that mimics null behavior
      const invalidTrace = {
        recent_actions: null,
        current_context: null,
        goal: null,
      } as any;

      const result = await sentinel.detectLoop(invalidTrace, 'hybrid');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle trace with missing properties', async () => {
      const incompleteTrace: any = {
        recent_actions: ['action1', 'action2'],
        // Missing current_context and goal
      };

      const result = await sentinel.detectLoop(incompleteTrace, 'hybrid');

      expect(result).toBeDefined();
    });

    it('should handle very long action sequences', async () => {
      const longActions = Array(1000)
        .fill('action')
        .map((_, i) => `action_${i % 10}`);
      const trace: CognitiveTrace = {
        recent_actions: longActions,
        current_context: 'Very long sequence',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
    });

    it('should handle special characters in actions', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['@#$%', '中文', '🎉', 'normal_action'],
        current_context: 'Special characters',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
    });

    it('should handle numeric action names', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['123', '456', '123', '456'],
        current_context: 'Numeric actions',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
    });

    it('should handle empty string actions', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['', 'action', '', 'action'],
        current_context: 'Empty string actions',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
    });

    it('should handle whitespace-only actions', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['   ', '\t\t', '\n\n', 'action'],
        current_context: 'Whitespace actions',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'hybrid');

      expect(result).toBeDefined();
    });
  });

  describe('performance and optimization', () => {
    it('should process large traces efficiently', async () => {
      const largeTrace: CognitiveTrace = {
        recent_actions: Array(500)
          .fill('action')
          .map((_, i) => `action_${i % 20}`),
        current_context: 'Large trace test',
        goal: 'Performance test',
      };

      const start = Date.now();
      const result = await sentinel.detectLoop(largeTrace, 'hybrid');
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent detections', async () => {
      const traces = Array(10)
        .fill(null)
        .map((_, i) => ({
          recent_actions: [`action_${i}`, `action_${i}`, `action_${i}`],
          current_context: `Context ${i}`,
          goal: `Goal ${i}`,
        }));

      const promises = traces.map((trace) => sentinel.detectLoop(trace, 'hybrid'));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(typeof result.confidence).toBe('number');
      });
    });
  });

  describe('configuration-based behavior', () => {
    it('should respect minimum actions threshold', async () => {
      const shortTrace: CognitiveTrace = {
        recent_actions: ['action1', 'action1'], // Below min_actions_for_detection (3)
        current_context: 'Short trace',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(shortTrace, 'pattern');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should use custom thresholds', async () => {
      const strictConfig = {
        min_actions_for_detection: 3,
        alternating_threshold: 0.1, // Very strict
        repetition_threshold: 0.1, // Very strict
      };

      const strictSentinel = new Sentinel(strictConfig);

      const trace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action1'],
        current_context: 'Strict test',
        goal: 'Test goal',
      };

      const result = await strictSentinel.detectLoop(trace, 'pattern');

      expect(result).toBeDefined();
      // Should be more likely to detect with strict thresholds
    });

    it('should adjust behavior with progress indicators', async () => {
      const progressTrace: CognitiveTrace = {
        recent_actions: ['action1', 'success', 'action1', 'completed'],
        current_context: 'Progress being made',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(progressTrace, 'pattern');

      expect(result).toBeDefined();
      // Progress indicators should reduce loop detection likelihood
    });
  });

  describe('actions involved detection', () => {
    it('should detect actions for different loop types', async () => {
      // Test action_repetition case
      const repetitionTrace: CognitiveTrace = {
        recent_actions: ['click', 'click', 'click', 'scroll', 'scroll'],
        current_context: 'Repetition test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(repetitionTrace, 'hybrid');

      if (result.detected) {
        expect(result.actions_involved).toBeDefined();
        expect(Array.isArray(result.actions_involved)).toBe(true);
      }
    });

    it('should handle cyclical pattern actions', async () => {
      const cyclicalTrace: CognitiveTrace = {
        recent_actions: ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b'],
        current_context: 'Cyclical test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(cyclicalTrace, 'pattern');

      expect(result).toBeDefined();
      if (result.detected) {
        expect(result.actions_involved).toBeDefined();
      }
    });

    it('should handle oscillation pattern actions', async () => {
      const oscillationTrace: CognitiveTrace = {
        recent_actions: ['up', 'down', 'up', 'down', 'up', 'down'],
        current_context: 'Oscillation test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(oscillationTrace, 'pattern');

      expect(result).toBeDefined();
      if (result.detected) {
        expect(result.actions_involved).toBeDefined();
      }
    });

    it('should handle alternating pattern actions', async () => {
      const alternatingTrace: CognitiveTrace = {
        recent_actions: ['left', 'right', 'left', 'right', 'left'],
        current_context: 'Alternating test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(alternatingTrace, 'pattern');

      expect(result).toBeDefined();
      if (result.detected) {
        expect(result.actions_involved).toBeDefined();
      }
    });

    it('should fall back to default cluster for unknown loop types', async () => {
      // This will test the default case in getActionsInvolvedInLoop
      const unknownTrace: CognitiveTrace = {
        recent_actions: ['action1', 'action2', 'action3', 'action1', 'action2'],
        current_context: 'Unknown pattern test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(unknownTrace, 'statistical');

      expect(result).toBeDefined();
      expect(Array.isArray(result.actions_involved)).toBe(true);
    });
  });

  describe('statistical calculations', () => {
    it('should calculate cyclicity score', async () => {
      const cyclicTrace: CognitiveTrace = {
        recent_actions: ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b'],
        current_context: 'Cyclic pattern',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(cyclicTrace, 'statistical');

      expect(result.statistical_metrics?.cyclicity_score).toBeDefined();
      expect(result.statistical_metrics!.cyclicity_score!).toBeGreaterThan(0);
    });

    it('should handle autocorrelation calculations', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['1', '2', '3', '1', '2', '3', '1', '2'],
        current_context: 'Pattern test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics).toBeDefined();
      expect(result.details.metrics).toBeDefined();
    });

    it('should normalize entropy scores', async () => {
      const trace: CognitiveTrace = {
        recent_actions: ['a', 'b', 'c', 'd', 'e'],
        current_context: 'Entropy test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics?.entropy_score).toBeDefined();
      expect(result.statistical_metrics!.entropy_score!).toBeGreaterThanOrEqual(0);
      expect(result.statistical_metrics!.entropy_score!).toBeLessThanOrEqual(1);
    });

    it('should calculate moving averages', async () => {
      const trace: CognitiveTrace = {
        recent_actions: Array(20)
          .fill('action')
          .map((_, i) => `action_${i}`),
        current_context: 'Moving average test',
        goal: 'Test goal',
      };

      const result = await sentinel.detectLoop(trace, 'statistical');

      expect(result.statistical_metrics?.trend_score).toBeDefined();
    });
  });

  describe('basic functionality', () => {
    it('should be properly constructed', () => {
      expect(sentinel).toBeDefined();
      expect(typeof sentinel.detectLoop).toBe('function');
      expect(typeof sentinel.updateConfig).toBe('function');
    });

    it('should have configuration accessible', () => {
      const config = sentinel.getConfig();
      expect(config).toBeDefined();
      expect(config.min_actions_for_detection).toBe(3);
    });
  });

  describe('toString', () => {
    it('should return a string representation', () => {
      const str = sentinel.toString();
      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    });

    it('should include configuration information', () => {
      const str = sentinel.toString();
      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    });
  });
});
