import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ChildProcess } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MCPClient } from 'mcp-client';

// Load test fixtures
const loadFixture = (filename: string) => {
  const fixturePath = join(__dirname, 'fixtures', filename);
  return JSON.parse(readFileSync(fixturePath, 'utf-8'));
};

const complexScenarioFixture = loadFixture('browser_use_complex_scenario.json');
const loopFixture = loadFixture('browser_use_loop_fixture.json');
const scrollFixture = loadFixture('browser_use_scroll_fixture.json');

/**
 * Live MCP Server Integration Tests
 *
 * These tests spin up the actual MCP server process and interact with it
 * using the MCP protocol, providing a near-real-life scenario for testing
 * the dual-cycle reasoning framework.
 */
describe('Live MCP Server Integration', () => {
  let serverProcess: ChildProcess;
  let mcpClient: MCPClient;
  let serverReady = false;

  beforeAll(async () => {
    // Create MCP client
    mcpClient = new MCPClient({
      name: 'test-client',
      version: '1.0.0',
    });

    // Connect to the MCP server using stdio
    await mcpClient.connect({
      type: 'stdio',
      command: 'node',
      args: ['build/server.js', '--stdio'],
    });

    serverReady = true;
  }, 35000);

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
  });

  beforeEach(async () => {
    // Reset the engine before each test
    await mcpClient.callTool({
      name: 'reset_engine',
      arguments: {},
    });
  });

  describe('Complex Scenario Live Tests', () => {
    it('should handle complete workflow with complex scenario fixture', async () => {
      const trace = complexScenarioFixture.cognitive_trace;

      // Start monitoring
      const startResult = await mcpClient.callTool({
        name: 'start_monitoring',
        arguments: {
          goal: trace.goal,
          initial_beliefs: [
            'Pricing information should be accessible',
            'Modal interactions may be required',
          ],
        },
      });

      expect((startResult as any).content[0].text).toContain('✅ Metacognitive monitoring started');

      // Process the trace actions one by one
      let processResult;
      let result;
      for (const action of trace.recent_actions) {
        processResult = await mcpClient.callTool({
          name: 'process_trace_update',
          arguments: {
            last_action: action,
            current_context: trace.current_context,
            goal: trace.goal,
            window_size: 10,
          },
        });

        // Parse result and break if intervention is required
        result = JSON.parse((processResult as any).content[0].text);
        if (result.intervention_required) {
          break;
        }
      }

      // The complex scenario should trigger intervention due to loop detection
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);

      // Get monitoring status
      const statusResult = await mcpClient.callTool({
        name: 'get_monitoring_status',
        arguments: {},
      });

      const status = JSON.parse((statusResult as any).content[0].text);
      expect(status.is_monitoring).toBe(true);
      expect(status.current_goal).toBe(trace.goal);
      expect(status.trace_length).toBeLessThanOrEqual(trace.recent_actions.length);
    });

    it('should store and retrieve experience in live environment', async () => {
      // Store experience
      const storeResult = await mcpClient.callTool({
        name: 'store_experience',
        arguments: {
          problem_description: 'Complex pricing table navigation',
          solution: 'Navigate to pricing page and interact with comparison modal',
          outcome: true,
        },
      });

      expect((storeResult as any).content[0].text).toContain('✅ Experience stored');

      // Retrieve similar cases
      const retrieveResult = await mcpClient.callTool({
        name: 'retrieve_similar_cases',
        arguments: {
          problem_description: 'pricing comparison task',
          max_results: 3,
        },
      });

      const cases = JSON.parse((retrieveResult as any).content[0].text);
      expect(cases.length).toBeGreaterThan(0);
      expect(cases[0]).toHaveProperty('problem_description');
      expect(cases[0]).toHaveProperty('solution');
    });
  });

  describe('Loop Detection Live Tests', () => {
    it('should detect and handle loops in live environment', async () => {
      const trace = loopFixture.cognitive_trace;

      // Start monitoring
      await mcpClient.callTool({
        name: 'start_monitoring',
        arguments: {
          goal: trace.goal,
          initial_beliefs: ['Download button should be visible', 'Page content is accessible'],
        },
      });

      // Process the trace actions one by one (should detect loop)
      let processResult;
      for (const action of trace.recent_actions) {
        processResult = await mcpClient.callTool({
          name: 'process_trace_update',
          arguments: {
            last_action: action,
            current_context: trace.current_context,
            goal: trace.goal,
            window_size: 10,
          },
        });

        // Break if intervention is required
        const result = JSON.parse((processResult as any).content[0].text);
        if (result.intervention_required) {
          break;
        }
      }

      const result = JSON.parse((processResult as any).content[0].text);
      expect(result.intervention_required).toBe(true);
      expect(result.loop_detected?.detected).toBe(true);
      expect(result.loop_detected?.type).toMatch(
        /state_invariance|action_repetition|progress_stagnation/
      );
      expect(result.diagnosis).toBeDefined();
      expect(result.recovery_plan).toBeDefined();

      // Additional step: Call detect_loop to verify accumulated actions
      const detectResult = await mcpClient.callTool({
        name: 'detect_loop',
        arguments: {
          current_context: trace.current_context,
          goal: trace.goal,
          detection_method: 'hybrid',
        },
      });

      const detectResultText = (detectResult as any).content[0].text;

      // Check if it's an error message or valid JSON
      if (detectResultText.startsWith('❌ Error executing')) {
        // Handle error case - test should fail with a descriptive message
        throw new Error(`Loop detection failed: ${detectResultText}`);
      }

      const loopResult = JSON.parse(detectResultText);
      expect(loopResult.detected).toBe(true);
      expect(loopResult.type).toBeDefined();
      expect(loopResult.confidence).toBeGreaterThan(0);
      expect(loopResult.details).toBeDefined();

      // Update recovery outcome
      const updateResult = await mcpClient.callTool({
        name: 'update_recovery_outcome',
        arguments: {
          successful: true,
          explanation: 'Switched to alternative navigation strategy and found download button',
        },
      });

      expect((updateResult as any).content[0].text).toContain(
        '✅ Recovery outcome updated: SUCCESS'
      );
    }, 15000);
  });

  describe('Belief Revision Live Tests', () => {
    it('should revise beliefs in live environment', async () => {
      const trace = complexScenarioFixture.cognitive_trace;

      const reviseResult = await mcpClient.callTool({
        name: 'revise_beliefs',
        arguments: {
          current_beliefs: [
            'Pricing information is on the homepage',
            'No modal interactions are needed',
            'All pricing details are visible without scrolling',
          ],
          contradicting_evidence:
            'Had to navigate to pricing page and open modal to see comparison',
          goal: trace.goal,
        },
      });

      const revision = JSON.parse((reviseResult as any).content[0].text);
      expect(revision.revised_beliefs).toBeDefined();
      expect(revision.removed_beliefs).toBeDefined();
      expect(revision.rationale).toBeDefined();
      // Check that beliefs were actually revised (either added or removed)
      expect(revision.revised_beliefs.length + revision.removed_beliefs.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Live Tests', () => {
    it('should configure detection parameters in live environment', async () => {
      const configResult = await mcpClient.callTool({
        name: 'configure_detection',
        arguments: {
          progress_indicators: ['success', 'found', 'completed', 'navigated'],
          min_actions_for_detection: 3,
          alternating_threshold: 0.4,
          repetition_threshold: 0.3,
          progress_threshold_adjustment: 0.1,
        },
      });

      expect((configResult as any).content[0].text).toContain('⚙️ Detection configuration updated');
      expect((configResult as any).content[0].text).toContain('Min actions for detection: 3');
      expect((configResult as any).content[0].text).toContain('Alternating threshold: 0.4');
    });

    it('should handle different detection methods', async () => {
      const trace = scrollFixture.cognitive_trace;

      // Test statistical detection
      // First populate the internal trace by processing actions
      await mcpClient.callTool({
        name: 'start_monitoring',
        arguments: {
          goal: trace.goal,
          initial_beliefs: [],
        },
      });

      // Add actions to internal trace
      for (const action of trace.recent_actions) {
        await mcpClient.callTool({
          name: 'process_trace_update',
          arguments: {
            last_action: action,
            current_context: trace.current_context,
            goal: trace.goal,
          },
        });
      }

      const statisticalResult = await mcpClient.callTool({
        name: 'detect_loop',
        arguments: {
          current_context: trace.current_context,
          goal: trace.goal,
          detection_method: 'statistical',
        },
      });

      const statisticalLoop = JSON.parse((statisticalResult as any).content[0].text);
      expect(statisticalLoop).toBeDefined();

      // Test pattern detection
      const patternResult = await mcpClient.callTool({
        name: 'detect_loop',
        arguments: {
          current_context: trace.current_context,
          goal: trace.goal,
          detection_method: 'pattern',
        },
      });

      const patternLoop = JSON.parse((patternResult as any).content[0].text);
      expect(patternLoop).toBeDefined();
    }, 15000);
  });

  describe('Session Management Live Tests', () => {
    it('should handle session lifecycle in live environment', async () => {
      const trace = scrollFixture.cognitive_trace;

      // Start monitoring
      const startResult = await mcpClient.callTool({
        name: 'start_monitoring',
        arguments: {
          goal: trace.goal,
          initial_beliefs: ['Scroll pattern should find target', 'Page content is dynamic'],
        },
      });

      expect((startResult as any).content[0].text).toContain('✅ Metacognitive monitoring started');

      // Process partial trace
      const partialActions = trace.recent_actions.slice(0, 3);

      for (const action of partialActions) {
        await mcpClient.callTool({
          name: 'process_trace_update',
          arguments: {
            last_action: action,
            current_context: trace.current_context,
            goal: trace.goal,
            window_size: 10,
          },
        });
      }

      // Get status
      const statusResult = await mcpClient.callTool({
        name: 'get_monitoring_status',
        arguments: {},
      });

      const status = JSON.parse((statusResult as any).content[0].text);
      expect(status.is_monitoring).toBe(true);
      expect(status.trace_length).toBe(3);

      // Stop monitoring
      const stopResult = await mcpClient.callTool({
        name: 'stop_monitoring',
        arguments: {},
      });

      expect((stopResult as any).content[0].text).toContain('🛑 Monitoring stopped');
      expect((stopResult as any).content[0].text).toContain('Goal:');
      expect((stopResult as any).content[0].text).toContain('Total interventions:');
    });
  });

  describe('Error Handling Live Tests', () => {
    it('should handle invalid requests gracefully', async () => {
      // Test invalid tool name - should throw McpError
      try {
        await mcpClient.callTool({
          name: 'nonexistent_tool',
          arguments: {},
        });
        fail('Expected McpError to be thrown');
      } catch (error: any) {
        expect(error.name).toBe('McpError');
        expect(error.message).toContain('Unknown tool');
        expect(error.message).toContain('nonexistent_tool');
      }
    });

    it('should handle malformed trace data', async () => {
      // Test malformed parameters - should throw McpError
      try {
        await mcpClient.callTool({
          name: 'process_trace_update',
          arguments: {
            // Missing required fields - last_action and goal are required
            current_context: 'test',
          },
        });
        fail('Expected McpError to be thrown');
      } catch (error: any) {
        expect(error.name).toBe('McpError');
        expect(error.message).toContain('parameter validation failed');
        expect(error.message).toContain('last_action: Required');
        expect(error.message).toContain('goal: Required');
      }
    });
  });
});
