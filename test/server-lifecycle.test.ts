// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { EventEmitter } from 'events';

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

// Controllable semantic analyzer mock (variables prefixed with `mock` are
// allowed inside the jest.mock factory)
const mockAnalyzerState = { ready: true, failInitialize: false };

jest.mock('../src/semantic-analyzer', () => ({
  semanticAnalyzer: {
    initialize: jest.fn(async () => {
      if (mockAnalyzerState.failInitialize) {
        throw new Error('model download failed');
      }
    }),
    isReady: jest.fn(() => mockAnalyzerState.ready),
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
      texts.map((_, i) => texts.map((__, j) => (i === j ? 1.0 : 0.85)))
    ),
  },
}));

// The runtime path helpers rely on import.meta, which the CJS test build
// cannot evaluate; keep the auto-start guard off under test
jest.mock('../src/runtime-paths', () => ({
  getModuleDir: jest.fn(() => process.cwd() + '/src'),
  isEntryPoint: jest.fn(() => false),
}));

import { FastMCP } from 'fastmcp';
import { DualCycleReasonerServer } from '../src/server';
import { semanticAnalyzer } from '../src/semantic-analyzer';

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

describe('DualCycleReasonerServer lifecycle and tool flows', () => {
  let serverInstance: DualCycleReasonerServer;
  let fastmcp: FastMCP;
  let tools: Record<string, any>;
  let signalHandlers: Record<string, () => Promise<void> | void>;

  beforeAll(() => {
    const addToolSpy = jest.spyOn(FastMCP.prototype, 'addTool');
    const processOnSpy = jest.spyOn(process, 'on');

    serverInstance = new DualCycleReasonerServer();

    tools = Object.fromEntries(addToolSpy.mock.calls.map(([tool]) => [tool.name, tool]));
    signalHandlers = Object.fromEntries(
      processOnSpy.mock.calls
        .filter(([event]) => event === 'SIGINT' || event === 'SIGTERM')
        .map(([event, handler]) => [event, handler])
    );
    fastmcp = (serverInstance as any).server;

    addToolSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  afterAll(() => {
    mockAnalyzerState.ready = true;
    mockAnalyzerState.failInitialize = false;
    jest.restoreAllMocks();
  });

  describe('detect_loop tool', () => {
    it('should detect a loop from accumulated repetitive actions', async () => {
      const session = {};

      await tools['start_monitoring'].execute(
        { goal: 'Find button', initial_beliefs: [] },
        createContext(session)
      );

      for (let i = 0; i < 6; i++) {
        await tools['process_trace_update'].execute(
          { last_action: 'scroll_down', current_context: 'page', goal: 'Find button' },
          createContext(session)
        );
      }

      const result = JSON.parse(
        await tools['detect_loop'].execute(
          { goal: 'Find button', detection_method: 'hybrid' },
          createContext(session)
        )
      );

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      // Confidence is rounded to two decimals for the payload
      expect(result.confidence).toBe(parseFloat(result.confidence.toFixed(2)));
    });

    it('should support the statistical and pattern methods with a context override', async () => {
      const session = {};

      await tools['start_monitoring'].execute(
        { goal: 'Browse', initial_beliefs: [] },
        createContext(session)
      );
      for (let i = 0; i < 6; i++) {
        await tools['process_trace_update'].execute(
          { last_action: `action_${i}`, current_context: 'page', goal: 'Browse' },
          createContext(session)
        );
      }

      const statistical = JSON.parse(
        await tools['detect_loop'].execute(
          { goal: 'Browse', detection_method: 'statistical', current_context: 'same_page' },
          createContext(session)
        )
      );
      const pattern = JSON.parse(
        await tools['detect_loop'].execute(
          { goal: 'Browse', detection_method: 'pattern', current_context: 'same_page' },
          createContext(session)
        )
      );

      expect(typeof statistical.detected).toBe('boolean');
      expect(typeof pattern.detected).toBe('boolean');
    });

    it('should reject an invalid detection method', async () => {
      const session = {};

      await expect(
        tools['detect_loop'].execute(
          { goal: 'Browse', detection_method: 'quantum' },
          createContext(session)
        )
      ).rejects.toThrow('Failed to detect loop');
    });
  });

  describe('monitoring lifecycle tools', () => {
    it('should stop monitoring and report a session summary', async () => {
      const session = {};

      await tools['start_monitoring'].execute(
        { goal: 'Lifecycle goal', initial_beliefs: ['belief'] },
        createContext(session)
      );
      await tools['process_trace_update'].execute(
        { last_action: 'first_step', goal: 'Lifecycle goal' },
        createContext(session)
      );

      const summary = await tools['stop_monitoring'].execute({}, createContext(session));

      expect(summary).toContain('Monitoring stopped');
      expect(summary).toContain('Lifecycle goal');
      expect(summary).toContain('Trace length: 1');
    });

    it('should reset the engine state', async () => {
      const session = {};

      await tools['start_monitoring'].execute(
        { goal: 'Reset goal', initial_beliefs: [] },
        createContext(session)
      );
      await tools['process_trace_update'].execute(
        { last_action: 'some_action', goal: 'Reset goal' },
        createContext(session)
      );

      const response = await tools['reset_engine'].execute({}, createContext(session));
      expect(response).toContain('has been reset');

      const status = JSON.parse(
        await tools['get_monitoring_status'].execute({}, createContext(session))
      );
      expect(status.is_monitoring).toBe(false);
      expect(status.trace_length).toBe(0);
      expect(status.recent_actions).toHaveLength(0);
    });

    it('should initialize the analyzer on start_monitoring when it is not ready', async () => {
      const session = {};
      mockAnalyzerState.ready = false;

      const response = await tools['start_monitoring'].execute(
        { goal: 'Init goal', initial_beliefs: [] },
        createContext(session)
      );

      expect(response).toContain('Metacognitive monitoring started');
      expect(semanticAnalyzer.initialize).toHaveBeenCalled();
      mockAnalyzerState.ready = true;
    });

    it('should surface start_monitoring failures as user errors', async () => {
      const session = {};
      mockAnalyzerState.ready = false;
      mockAnalyzerState.failInitialize = true;

      await expect(
        tools['start_monitoring'].execute(
          { goal: 'Failing goal', initial_beliefs: [] },
          createContext(session)
        )
      ).rejects.toThrow('Failed to start monitoring: model download failed');

      mockAnalyzerState.ready = true;
      mockAnalyzerState.failInitialize = false;
    });
  });

  describe('tool error paths', () => {
    it('should reject invalid process_trace_update arguments', async () => {
      await expect(
        tools['process_trace_update'].execute(
          { last_action: 'x', goal: 'g', window_size: 'not-a-number' },
          createContext({})
        )
      ).rejects.toThrow('Failed to process trace update');
    });

    it('should reject invalid store_experience arguments', async () => {
      await expect(
        tools['store_experience'].execute(
          { problem_description: 'p', solution: 's', outcome: 'yes' },
          createContext({})
        )
      ).rejects.toThrow('Failed to store experience');
    });

    it('should reject invalid retrieve_similar_cases arguments', async () => {
      await expect(
        tools['retrieve_similar_cases'].execute(
          { problem_description: 'p', max_results: 'many' },
          createContext({})
        )
      ).rejects.toThrow('Failed to retrieve similar cases');
    });

    it('should surface stop_monitoring, status and reset failures as user errors', async () => {
      const session = {};

      // Materialize the engine, then make its status/reset paths fail
      await tools['get_monitoring_status'].execute({}, createContext(session));
      const engine = (serverInstance as any).engines.get(session);
      jest.spyOn(engine, 'getMonitoringStatus').mockImplementation(() => {
        throw new Error('status unavailable');
      });
      jest.spyOn(engine, 'reset').mockImplementation(() => {
        throw new Error('reset unavailable');
      });

      await expect(tools['stop_monitoring'].execute({}, createContext(session))).rejects.toThrow(
        'Failed to stop monitoring: status unavailable'
      );
      await expect(
        tools['get_monitoring_status'].execute({}, createContext(session))
      ).rejects.toThrow('Failed to get monitoring status: status unavailable');
      await expect(tools['reset_engine'].execute({}, createContext(session))).rejects.toThrow(
        'Failed to reset engine: reset unavailable'
      );
    });

    it('should surface configure_detection failures as user errors', async () => {
      const session = {};

      // Materialize the engine, then make its sentinel reject updates
      await tools['get_monitoring_status'].execute({}, createContext(session));
      const engine = (serverInstance as any).engines.get(session);
      jest.spyOn((engine as any).sentinel, 'updateConfig').mockImplementation(() => {
        throw new Error('sentinel unavailable');
      });

      await expect(
        tools['configure_detection'].execute(
          { min_actions_for_detection: 4 },
          createContext(session)
        )
      ).rejects.toThrow('Failed to configure detection parameters: sentinel unavailable');
    });
  });

  describe('configure_detection semantic intents', () => {
    it('should propagate semantic intents to the adjudicator', async () => {
      const session = {};

      await tools['get_monitoring_status'].execute({}, createContext(session));
      const engine = (serverInstance as any).engines.get(session);
      const intentsSpy = jest.spyOn((engine as any).adjudicator, 'updateSemanticIntents');

      const response = await tools['configure_detection'].execute(
        { semantic_intents: ['navigating', 'clicking'] },
        createContext(session)
      );

      expect(intentsSpy).toHaveBeenCalledWith(['navigating', 'clicking']);
      expect(response).toContain('navigating, clicking');
    });
  });

  describe('session event handling', () => {
    it('should track connected sessions and clean up on disconnect', async () => {
      const fakeSession = Object.assign(new EventEmitter(), {
        clientCapabilities: { name: 'test-client' },
      });

      fastmcp.emit('connect', { session: fakeSession });

      // Session id assigned on connect
      expect((serverInstance as any).sessionIds.has(fakeSession)).toBe(true);

      // Session-scoped events are wired up
      fakeSession.emit('rootsChanged', { roots: ['file:///tmp'] });
      fakeSession.emit('error', { error: new Error('session issue') });

      // Materialize an engine for the session, then disconnect
      await tools['get_monitoring_status'].execute({}, createContext(fakeSession));
      expect((serverInstance as any).engines.has(fakeSession)).toBe(true);

      fastmcp.emit('disconnect', { session: fakeSession });

      expect((serverInstance as any).engines.has(fakeSession)).toBe(false);
      expect((serverInstance as any).sessionIds.has(fakeSession)).toBe(false);
      expect(semanticAnalyzer.clearSessionCache).toHaveBeenCalled();
    });

    it('should handle disconnects for sessions without engines', () => {
      const unknownSession = Object.assign(new EventEmitter(), {});

      expect(() => fastmcp.emit('disconnect', { session: unknownSession })).not.toThrow();
    });

    it('should warn when too many sessions accumulate', () => {
      jest.useFakeTimers();
      const warnServer = new DualCycleReasonerServer();

      for (let i = 0; i < 101; i++) {
        (warnServer as any).engines.set({ id: i }, {});
      }

      expect(() => jest.advanceTimersByTime(300001)).not.toThrow();
      jest.useRealTimers();
    });
  });

  describe('server start/stop', () => {
    it('should start with stdio transport after initializing the analyzer', async () => {
      const startSpy = jest.spyOn(FastMCP.prototype, 'start').mockResolvedValue(undefined);

      const stdioServer = new DualCycleReasonerServer();
      await stdioServer.start({ transportType: 'stdio' });

      expect(startSpy).toHaveBeenCalledWith({ transportType: 'stdio' });
      startSpy.mockRestore();
    });

    it('should start with HTTP stream transport on the requested port', async () => {
      const startSpy = jest.spyOn(FastMCP.prototype, 'start').mockResolvedValue(undefined);

      const httpServer = new DualCycleReasonerServer();
      await httpServer.start({ transportType: 'httpStream', port: 9999 });

      expect(startSpy).toHaveBeenCalledWith({
        transportType: 'httpStream',
        httpStream: { port: 9999 },
      });
      startSpy.mockRestore();
    });

    it('should continue startup when analyzer initialization times out', async () => {
      jest.useFakeTimers();
      const startSpy = jest.spyOn(FastMCP.prototype, 'start').mockResolvedValue(undefined);
      // An initialize call that never settles forces the 120s timeout branch
      (semanticAnalyzer.initialize as jest.Mock).mockImplementationOnce(
        () => new Promise(() => {})
      );

      const slowServer = new DualCycleReasonerServer();
      const startPromise = slowServer.start({ transportType: 'stdio' });

      await jest.advanceTimersByTimeAsync(120001);
      await expect(startPromise).resolves.toBeUndefined();

      expect(startSpy).toHaveBeenCalled();
      startSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should continue startup when analyzer initialization fails', async () => {
      const startSpy = jest.spyOn(FastMCP.prototype, 'start').mockResolvedValue(undefined);
      mockAnalyzerState.failInitialize = true;

      const resilientServer = new DualCycleReasonerServer();
      await expect(resilientServer.start({ transportType: 'stdio' })).resolves.toBeUndefined();

      mockAnalyzerState.failInitialize = false;
      startSpy.mockRestore();
    });

    it('should stop the underlying FastMCP server', async () => {
      const stopSpy = jest.spyOn(FastMCP.prototype, 'stop').mockResolvedValue(undefined);

      await serverInstance.stop();

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });

    it('should shut down gracefully on SIGINT and SIGTERM', async () => {
      const stopSpy = jest.spyOn(FastMCP.prototype, 'stop').mockResolvedValue(undefined);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await signalHandlers['SIGINT']();
      await signalHandlers['SIGTERM']();

      expect(stopSpy).toHaveBeenCalledTimes(2);
      expect(exitSpy).toHaveBeenCalledWith(0);

      stopSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
