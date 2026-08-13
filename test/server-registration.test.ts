// @ts-nocheck
import { describe, it, expect, beforeAll, jest } from '@jest/globals';

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

// Mock semantic analyzer so tool handlers run without model downloads
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
      texts.map((_, i) => texts.map((__, j) => (i === j ? 1.0 : 0.1)))
    ),
  },
}));

// Mock the runtime path helpers: they rely on import.meta, which the CJS test
// build cannot evaluate, and the auto-start guard must stay off under test
jest.mock('../src/runtime-paths', () => ({
  getModuleDir: jest.fn(() => process.cwd() + '/src'),
  isEntryPoint: jest.fn(() => false),
}));

import { FastMCP } from 'fastmcp';
import { DualCycleReasonerServer } from '../src/server';

const createContext = (session: object) => ({
  session,
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  reportProgress: jest.fn(async () => {}),
});

describe('DualCycleReasonerServer tool registration', () => {
  let tools: Record<string, any>;

  beforeAll(() => {
    const addToolSpy = jest.spyOn(FastMCP.prototype, 'addTool');
    new DualCycleReasonerServer();
    tools = Object.fromEntries(addToolSpy.mock.calls.map(([tool]) => [tool.name, tool]));
    addToolSpy.mockRestore();
  });

  it('should register every documented tool', () => {
    expect(Object.keys(tools).sort()).toEqual(
      [
        'configure_detection',
        'detect_loop',
        'get_monitoring_status',
        'process_trace_update',
        'reset_engine',
        'retrieve_similar_cases',
        'start_monitoring',
        'stop_monitoring',
        'store_experience',
      ].sort()
    );
  });

  it('should expose the documented store_experience parameters', () => {
    const shape = tools['store_experience'].parameters.shape;
    expect(shape.problem_description).toBeDefined();
    expect(shape.solution).toBeDefined();
    expect(shape.outcome).toBeDefined();
    expect(shape.context).toBeDefined();
    expect(shape.difficulty_level).toBeDefined();
  });

  it('should expose the documented retrieve_similar_cases filter parameters', () => {
    const shape = tools['retrieve_similar_cases'].parameters.shape;
    expect(shape.problem_description).toBeDefined();
    expect(shape.max_results).toBeDefined();
    expect(shape.context_filter).toBeDefined();
    expect(shape.difficulty_filter).toBeDefined();
    expect(shape.outcome_filter).toBeDefined();
    expect(shape.min_similarity).toBeDefined();
  });

  it('should store and retrieve experiences honoring context and difficulty filters', async () => {
    const session = {};

    await tools['store_experience'].execute(
      {
        problem_description: 'Form submission button not responding to clicks',
        solution: 'Ensure all required fields are filled correctly',
        outcome: true,
        context: 'registration_form',
        difficulty_level: 'high',
      },
      createContext(session)
    );

    const matching = JSON.parse(
      await tools['retrieve_similar_cases'].execute(
        {
          problem_description: 'Submit button does not respond',
          max_results: 5,
          difficulty_filter: 'high',
          context_filter: 'registration_form',
          min_similarity: 0.1,
        },
        createContext(session)
      )
    );

    const nonMatching = JSON.parse(
      await tools['retrieve_similar_cases'].execute(
        {
          problem_description: 'Submit button does not respond',
          max_results: 5,
          difficulty_filter: 'low',
          min_similarity: 0.1,
        },
        createContext(session)
      )
    );

    expect(matching).toHaveLength(1);
    expect(matching[0].context).toBe('registration_form');
    expect(matching[0].difficulty_level).toBe('high');
    expect(nonMatching).toHaveLength(0);
  });

  it('should preserve previously configured values on partial configure_detection updates', async () => {
    const session = {};

    await tools['configure_detection'].execute(
      { min_actions_for_detection: 3 },
      createContext(session)
    );
    const response = await tools['configure_detection'].execute(
      { progress_indicators: ['task_done'] },
      createContext(session)
    );

    expect(response).toContain('Min actions for detection: 3');
    expect(response).toContain('task_done');
    // The default semantic intents must survive updates that do not touch them
    expect(response).toContain('performing action');
  });

  it('should include recent_actions in the monitoring status payload', async () => {
    const session = {};

    await tools['start_monitoring'].execute(
      { goal: 'Test goal', initial_beliefs: [] },
      createContext(session)
    );
    await tools['process_trace_update'].execute(
      { last_action: 'click_button', current_context: 'home', goal: 'Test goal' },
      createContext(session)
    );

    const status = JSON.parse(
      await tools['get_monitoring_status'].execute({}, createContext(session))
    );

    expect(status.is_monitoring).toBe(true);
    expect(status.trace_length).toBe(1);
    expect(status.recent_actions).toHaveLength(1);
    expect(status.recent_actions[0]).toEqual({
      type: 'click_button',
      timestamp: expect.any(Number),
    });
  });
});
