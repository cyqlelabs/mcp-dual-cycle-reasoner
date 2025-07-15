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
    it('should successfully process complex scenario trace without detecting loops', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Start monitoring
      engine.startMonitoring(trace.goal, []);

      // Process the trace
      const result = await engine.processTraceUpdate(trace);

      expect(result).toBeDefined();
      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected?.detected).toBe(false);

      // Verify monitoring status
      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe(trace.goal);
      expect(status.trace_length).toBe(trace.recent_actions.length);
    });

    it('should detect progress indicators in complex scenario', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Configure with specific progress indicators
      const progressConfig = {
        ...config,
        progress_indicators: ['click_element_by_index', 'extract_structured_data'],
      };

      const progressEngine = new DualCycleEngine(progressConfig);
      progressEngine.startMonitoring(trace.goal, []);

      const result = await progressEngine.processTraceUpdate(trace);

      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected?.detected).toBe(false);
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
      adjudicator.storeExperience(experience);

      // Retrieve similar cases
      const similarCases = engine.getSimilarCases('pricing table comparison', 3);

      expect(similarCases).toBeDefined();
      expect(similarCases.length).toBeGreaterThan(0);
      expect(similarCases[0].problem_description).toContain('pricing');
    });
  });

  describe('Loop Detection Fixture Tests', () => {
    it('should detect loops in repetitive scrolling pattern', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      engine.startMonitoring(trace.goal, []);

      // Process the trace with loop detection
      const result = await engine.processTraceUpdate(trace);

      expect(result).toBeDefined();
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.loop_detected?.type).toBe('progress_stagnation');
      expect(result.loop_detected?.confidence).toBeGreaterThan(0.5);
    });

    it('should confirm browser_use_loop_fixture.json triggers loop detection', async () => {
      // This is the critical test - the loop fixture should ALWAYS trigger a loop
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      engine.startMonitoring(trace.goal, []);
      const result = await engine.processTraceUpdate(trace);

      // Assert that the loop fixture definitively triggers loop detection
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.loop_detected?.confidence).toBeGreaterThan(0.5);
      expect(result.loop_detected?.details).toBeDefined();
      expect(result.diagnosis).toBeDefined();
      expect(result.recovery_plan).toBeDefined();
    });

    it('should confirm other fixtures do NOT trigger loops', async () => {
      // Complex scenario should NOT trigger loop detection
      const complexTrace: CognitiveTrace = complexScenarioFixture.cognitive_trace;
      engine.startMonitoring(complexTrace.goal, []);
      const complexResult = await engine.processTraceUpdate(complexTrace);

      expect(complexResult.intervention_required).toBe(false);
      expect(complexResult.loop_detected?.detected).toBe(false);

      // Reset for next test
      engine.reset();

      // Scroll fixture should NOT trigger loop detection
      const scrollTrace: CognitiveTrace = scrollFixture.cognitive_trace;
      engine.startMonitoring(scrollTrace.goal, []);
      const scrollResult = await engine.processTraceUpdate(scrollTrace);

      expect(scrollResult.intervention_required).toBe(false);
      expect(scrollResult.loop_detected?.detected).toBe(false);
    });

    it('should use hybrid detection method for loop fixture', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      const sentinel = (engine as any).sentinel;
      const loopResult = sentinel.detectLoop(trace, 'hybrid');

      expect(loopResult.detected).toBe(true);
      expect(loopResult.type).toBe('progress_stagnation');
      expect(loopResult.details).toContain('diversity');
      if (loopResult.actions_involved) {
        expect(loopResult.actions_involved.length).toBeGreaterThan(0);
      }
    });

    it('should diagnose failure and generate recovery plan for loop', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      const sentinel = (engine as any).sentinel;
      const adjudicator = (engine as any).adjudicator;

      // Detect loop
      const loopResult = sentinel.detectLoop(trace, 'hybrid');

      // Diagnose failure
      const diagnosis = await adjudicator.diagnoseFailure(loopResult, trace);

      expect(diagnosis).toBeDefined();
      expect(diagnosis.primary_hypothesis).toBeDefined();
      expect(diagnosis.confidence).toBeGreaterThan(0);
      expect(diagnosis.suggested_actions).toBeDefined();
      expect(diagnosis.suggested_actions.length).toBeGreaterThan(0);

      // Generate recovery plan
      const recoveryPlan = adjudicator.generateRecoveryPlan(diagnosis, trace);

      expect(recoveryPlan).toBeDefined();
      expect(recoveryPlan.pattern).toBeDefined();
      expect(recoveryPlan.actions).toBeDefined();
      expect(recoveryPlan.actions.length).toBeGreaterThan(0);
      expect(recoveryPlan.rationale).toBeDefined();
    });

    it('should handle recovery outcome updates', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      engine.startMonitoring(trace.goal, []);
      await engine.processTraceUpdate(trace);

      // Update recovery outcome
      engine.updateRecoveryOutcome(true, 'Alternative navigation strategy worked');

      const status = engine.getMonitoringStatus();
      expect(status.intervention_count).toBeGreaterThan(0);
    });
  });

  describe('Scroll Fixture Tests', () => {
    it('should handle successful scroll-to-find pattern', async () => {
      const trace: CognitiveTrace = scrollFixture.cognitive_trace;

      engine.startMonitoring(trace.goal, []);

      const result = await engine.processTraceUpdate(trace);

      expect(result).toBeDefined();
      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected?.detected).toBe(false);
    });

    it('should detect successful task completion pattern', async () => {
      const trace: CognitiveTrace = scrollFixture.cognitive_trace;

      // Configure with click success indicator
      const successConfig = {
        ...config,
        progress_indicators: ['click_element_by_index'],
      };

      const successEngine = new DualCycleEngine(successConfig);
      successEngine.startMonitoring(trace.goal, []);

      const result = await successEngine.processTraceUpdate(trace);

      expect(result.intervention_required).toBe(false);
      expect(result.loop_detected?.detected).toBe(false);
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

  describe('Belief Revision Tests', () => {
    it('should revise beliefs based on contradicting evidence', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      const initialBeliefs = [
        'Pricing information is on the homepage',
        'No modal interactions are needed',
        'All pricing details are visible without scrolling',
      ];

      const contradictingEvidence =
        'Had to navigate to pricing page and open modal to see comparison';

      const adjudicator = (engine as any).adjudicator;
      const revision = await adjudicator.reviseBeliefs(
        initialBeliefs,
        contradictingEvidence,
        trace
      );

      expect(revision).toBeDefined();
      expect(revision.revised_beliefs).toBeDefined();
      expect(revision.removed_beliefs).toBeDefined();
      expect(revision.rationale).toBeDefined();
      expect(revision.removed_beliefs.length).toBeGreaterThan(0);
    });

    it('should handle belief revision with semantic analysis', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      const beliefs = [
        'Download button is easily accessible',
        'No scrolling is required',
        'Page content is static',
      ];

      const evidence = 'Scrolled multiple times without finding the download button';

      const adjudicator = (engine as any).adjudicator;
      const revision = await adjudicator.reviseBeliefs(beliefs, evidence, trace);

      expect(revision).toBeDefined();
      expect(revision.revised_beliefs).toBeDefined();
      expect(revision.rationale).toBeDefined();
      if (revision.semantic_analysis) {
        expect(revision.semantic_analysis.confidence_level).toBeDefined();
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
      strictEngine.startMonitoring(loopFixture.cognitive_trace.goal, []);

      const result = await strictEngine.processTraceUpdate(loopFixture.cognitive_trace);

      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.confidence).toBeGreaterThan(0.5);
    });

    it('should adjust thresholds based on progress indicators', async () => {
      const progressConfig = {
        ...config,
        progress_indicators: ['success', 'found', 'completed'],
        progress_threshold_adjustment: 0.3,
      };

      const progressEngine = new DualCycleEngine(progressConfig);

      // Test with trace that has progress indicators
      const progressTrace: CognitiveTrace = {
        recent_actions: ['scroll_down', 'found_element', 'click_success'],
        current_context: 'task_completion',
        goal: 'Find and click button',
      };

      progressEngine.startMonitoring(progressTrace.goal, []);
      const result = await progressEngine.processTraceUpdate(progressTrace);

      expect(result.intervention_required).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from monitoring to recovery', async () => {
      const trace: CognitiveTrace = loopFixture.cognitive_trace;

      // Start monitoring
      engine.startMonitoring(trace.goal, ['Button should be visible', 'Page loads quickly']);

      // Process trace and detect loop
      const result = await engine.processTraceUpdate(trace);

      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.diagnosis).toBeDefined();
      expect(result.recovery_plan).toBeDefined();

      // Update recovery outcome
      engine.updateRecoveryOutcome(false, 'First recovery attempt failed');

      const status = engine.getMonitoringStatus();
      expect(status.intervention_count).toBe(1);
    });

    it('should maintain session state across multiple trace updates', async () => {
      const scrollTrace: CognitiveTrace = scrollFixture.cognitive_trace;

      engine.startMonitoring(scrollTrace.goal, []);

      // Process partial trace
      const partialTrace = {
        ...scrollTrace,
        recent_actions: scrollTrace.recent_actions.slice(0, 2),
      };

      const result1 = await engine.processTraceUpdate(partialTrace);
      expect(result1.intervention_required).toBe(false);

      // Process full trace
      const result2 = await engine.processTraceUpdate(scrollTrace);
      // May or may not detect loop depending on state
      expect(result2).toBeDefined();

      const status = engine.getMonitoringStatus();
      expect(status.trace_length).toBe(scrollTrace.recent_actions.length);
    });

    it('should reset engine state properly', async () => {
      const trace: CognitiveTrace = complexScenarioFixture.cognitive_trace;

      // Process some data
      engine.startMonitoring(trace.goal, ['Initial belief']);
      await engine.processTraceUpdate(trace);

      // Reset engine
      engine.reset();

      const status = engine.getMonitoringStatus();
      expect(status.is_monitoring).toBe(false);
      expect(status.trace_length).toBe(0);
      expect(status.intervention_count).toBe(0);
    });
  });
});
