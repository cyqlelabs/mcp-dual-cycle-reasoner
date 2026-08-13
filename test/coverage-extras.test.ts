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

// Controllable pairwise similarity so individual tests can force clustering
const mockSimilarity = { value: 0.1 };

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
      similarity: 0.9,
      confidence: 0.9,
      reasoning: 'Mock similarity',
    })),
    getBatchEmbeddings: jest.fn(async (texts) => texts.map(() => Array(384).fill(0.5))),
    computeSimilarityMatrix: jest.fn(async (texts) =>
      texts.map((_, i) => texts.map((__, j) => (i === j ? 1.0 : mockSimilarity.value)))
    ),
  },
}));

import { Sentinel } from '../src/sentinel';
import { Adjudicator } from '../src/adjudicator';

describe('Sentinel uncovered paths', () => {
  it('should detect parameter repetition across semantically similar actions', async () => {
    mockSimilarity.value = 0.9;
    const sentinel = new Sentinel({ min_actions_for_detection: 3 });

    const trace = {
      last_action: 'press_button_index_3',
      goal: 'test goal',
      recent_actions: [
        'click_button_index_3',
        'press_button_index_3',
        'click_button_index_3',
        'press_button_index_3',
        'click_button_index_3',
      ],
    };

    const result = await sentinel.detectActionAnomalies(trace);
    mockSimilarity.value = 0.1;

    expect(result.detected).toBe(true);
    expect(result.details.metrics.parameter_repetition).toBeGreaterThan(0.5);
    expect(result.actions_involved.length).toBeGreaterThan(0);
  });

  it('should identify actions involved per dominant method', () => {
    const sentinel = new Sentinel();
    const actions = ['click_index_1', 'tap_index_1', 'click_index_1', 'scroll_down'];
    const clusters = [['click_index_1', 'tap_index_1', 'click_index_1'], ['scroll_down']];

    const semantic = (sentinel as any).getActionsInvolvedInLoop(
      'semantic_repetition',
      actions,
      clusters
    );
    const parameter = (sentinel as any).getActionsInvolvedInLoop(
      'parameter_repetition',
      actions,
      clusters
    );
    const exact = (sentinel as any).getActionsInvolvedInLoop('exact_repetition', actions, clusters);
    const cyclical = (sentinel as any).getActionsInvolvedInLoop(
      'cyclical_pattern',
      actions,
      clusters
    );
    const fallback = (sentinel as any).getActionsInvolvedInLoop(
      'unknown_method',
      actions,
      clusters
    );

    expect(semantic).toEqual(['click_index_1', 'tap_index_1']);
    // Same "index_1" parameter across the cluster members
    expect(parameter).toEqual(expect.arrayContaining(['click_index_1', 'tap_index_1']));
    expect(exact).toEqual(['click_index_1']);
    expect(cyclical).toEqual(['click_index_1', 'tap_index_1']);
    expect(fallback).toEqual(['click_index_1', 'tap_index_1']);
  });

  it('should extract parenthesized and space-separated action parameters', () => {
    const sentinel = new Sentinel();

    const parenthesized = (sentinel as any).extractActionParameters('click(btn, 3)');
    expect(parenthesized.name).toBe('click');
    expect(parenthesized.params).toEqual(['btn', '3']);

    const spaced = (sentinel as any).extractActionParameters('navigate down twice');
    expect(spaced.name).toBe('navigate down twice');

    const suffixed = (sentinel as any).extractActionParameters('move_x_1_y_2');
    expect(suffixed.name).toBe('move');
    expect(suffixed.params).toEqual(['x_1', 'y_2']);

    // Leading parenthesis defeats the parser pattern and falls back verbatim
    const unparseable = (sentinel as any).extractActionParameters('(weird)');
    expect(unparseable.name).toBe('(weird)');
    expect(unparseable.params).toEqual([]);
  });

  it('should extract structured state features from a rich context string', () => {
    const sentinel = new Sentinel();

    const features = (sentinel as any).extractStateFeatures(
      'Viewing "Sign up" page at https://example.com/register status: loading count 42 disabled'
    );

    expect(features).toEqual(expect.arrayContaining(['num:42', 'text:Sign up', 'state:loading']));
    expect(features.some((f: string) => f.startsWith('url:'))).toBe(true);
    expect(features.some((f: string) => f.startsWith('kv:status=loading'))).toBe(true);
  });

  it('should report state invariance via convergence when states become similar', () => {
    const sentinel = new Sentinel({ min_actions_for_detection: 1 });
    // Force the convergence signal high while keeping exact matches below threshold
    jest.spyOn(sentinel as any, 'detectStateConvergence').mockReturnValue(0.9);

    const trace = {
      last_action: 'retry_action',
      goal: 'test goal',
      current_context: 'stable_context',
      recent_actions: ['retry_action', 'retry_action', 'other_action'],
    };

    const result = sentinel.detectStateInvariance(trace, 10);

    expect(result.detected).toBe(true);
    expect(result.type).toBe('state_invariance');
    expect(result.details.metrics.convergence_score).toBe(0.9);
    expect(result.actions_involved).toContain('retry_action');
  });

  it('should return no progress stagnation for missing action lists', async () => {
    const sentinel = new Sentinel();

    const result = await sentinel.detectProgressStagnation({
      last_action: 'x',
      goal: 'g',
      recent_actions: null,
    });

    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should guard semantic repetition ratio against empty inputs', () => {
    const sentinel = new Sentinel();

    expect((sentinel as any).calculateSemanticRepetition([], 0)).toBe(0);
    expect((sentinel as any).detectParameterPatterns(['a', 'b'], [['a'], ['b']])).toBe(0);
  });
});

describe('Adjudicator uncovered paths', () => {
  it('should short-circuit repeated initialization', async () => {
    const adjudicator = new Adjudicator();

    await adjudicator.initialize();
    await expect(adjudicator.initialize()).resolves.toBeUndefined();
  });

  it('should reject cases whose computed confidence is too low', async () => {
    const adjudicator = new Adjudicator();
    jest.spyOn(adjudicator as any, 'calculateCaseConfidence').mockReturnValue(0.1);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await adjudicator.storeExperience({
      problem_description: 'A problem',
      solution: 'A solution',
      outcome: true,
      usage_count: 0,
    });

    expect((adjudicator as any).caseBase).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith('Case rejected due to low confidence score:', 0.1);
    warnSpy.mockRestore();
  });

  it('should trigger pruning automatically when storing beyond the case base limit', async () => {
    const adjudicator = new Adjudicator();

    // Seed just over the limit so the next successful store triggers pruning
    for (let i = 0; i < 1000; i++) {
      (adjudicator as any).caseBase.push({
        id: `seed-${i}`,
        problem_description: `seed problem ${i} with entirely unrelated wording`,
        solution: `seed solution ${i}`,
        outcome: false,
        timestamp: i,
        usage_count: 0,
        success_rate: 0,
        confidence_score: 0.01,
      });
    }
    // Bypass the expensive duplicate scan; this store must reach the prune step
    jest.spyOn(adjudicator as any, 'isDuplicateCase').mockReturnValue(false);

    await adjudicator.storeExperience({
      problem_description: 'A brand new high quality problem description',
      solution: 'A brand new high quality solution',
      outcome: true,
      usage_count: 0,
    });

    expect((adjudicator as any).caseBase.length).toBeLessThanOrEqual(800);
  });

  it('should prune the case base down to the quality cap and rebuild the index', () => {
    const adjudicator = new Adjudicator();

    for (let i = 0; i < 1001; i++) {
      (adjudicator as any).caseBase.push({
        id: `case-${i}`,
        problem_description: `problem ${i}`,
        solution: `solution ${i}`,
        outcome: i % 2 === 0,
        timestamp: Date.now() - i * 1000,
        context: i % 3 === 0 ? 'shared_context' : undefined,
        usage_count: i % 10,
        success_rate: (i % 10) / 10,
        confidence_score: (i % 100) / 100,
      });
    }

    (adjudicator as any).pruneCaseBase();

    expect((adjudicator as any).caseBase).toHaveLength(800);
    // The index only contains surviving cases
    const indexed = [...(adjudicator as any).caseIndex.values()].flat();
    indexed.forEach((case_) => {
      expect((adjudicator as any).caseBase).toContain(case_);
    });
  });

  it('should score keyword overlap in feature similarity', () => {
    const adjudicator = new Adjudicator();

    const full = (adjudicator as any).calculateFeatureSimilarity(
      { intents: ['clicking'], keywords: ['button', 'form'], sentiment: 'positive' },
      { intents: ['clicking'], keywords: ['button', 'page'], sentiment: 'positive' }
    );
    const none = (adjudicator as any).calculateFeatureSimilarity(null, { intents: ['clicking'] });

    expect(full).toBeGreaterThan(0.5);
    expect(full).toBeLessThanOrEqual(1);
    expect(none).toBe(0);
  });

  it('should update success statistics for duplicate cases', async () => {
    const adjudicator = new Adjudicator();

    const caseData = {
      problem_description: 'Login form keeps rejecting valid credentials on submit',
      solution: 'Clear stale session cookies before retrying the login',
      outcome: true,
      usage_count: 0,
    };

    await adjudicator.storeExperience({ ...caseData });
    await adjudicator.storeExperience({ ...caseData, outcome: false });

    expect((adjudicator as any).caseBase).toHaveLength(1);
    const stored = (adjudicator as any).caseBase[0];
    expect(stored.usage_count).toBeGreaterThan(0);
    expect(stored.success_rate).toBeLessThanOrEqual(1);
  });
});
