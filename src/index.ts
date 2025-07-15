#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DualCycleEngine } from './dual-cycle-engine.js';
import {
  MonitorCognitiveTraceInputSchema,
  DetectLoopInputSchema,
  DiagnoseFailureInputSchema,
  ReviseBelifsInputSchema,
  GenerateRecoveryPlanInputSchema,
  StoreExperienceInputSchema,
  RetrieveSimilarCasesInputSchema,
  CaseSchema,
  SentinelConfig,
} from './types.js';
import { semanticAnalyzer } from './semantic-analyzer.js';
import chalk from 'chalk';

/**
 * MCP Server implementing the Dual-Cycle Metacognitive Reasoning Framework
 *
 * This server provides tools for autonomous agents to monitor their own cognition,
 * detect when they're stuck in loops, diagnose failures, and generate recovery plans.
 *
 * Based on the framework described in DUAL-CYCLE.MD, this implements:
 * - Sentinel functions for loop detection (monitoring)
 * - Adjudicator functions for failure diagnosis and recovery (control)
 * - Case-based reasoning for learning from experience
 * - Belief revision for maintaining logical consistency
 */

class DualCycleReasonerServer {
  private server: Server;
  private engine: DualCycleEngine;
  private config: Partial<SentinelConfig>;

  constructor() {
    this.server = new Server(
      {
        name: 'dual-cycle-reasoner',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Default configuration - domain-agnostic
    this.config = {
      progress_indicators: [],
      min_actions_for_detection: 5,
      alternating_threshold: 0.5,
      repetition_threshold: 0.4,
      progress_threshold_adjustment: 0.2,
    };

    this.engine = new DualCycleEngine(this.config);
    this.setupToolHandlers();
    this.setupErrorHandling();
    this.initializeSemanticAnalyzer();
  }

  private async initializeSemanticAnalyzer(): Promise<void> {
    try {
      await semanticAnalyzer.initialize();
      console.log(chalk.green('✓ Semantic analyzer initialized successfully'));
    } catch (error) {
      console.error(chalk.red('✗ Failed to initialize semantic analyzer:'), error);
    }
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_monitoring',
            description: "Start metacognitive monitoring of an agent's cognitive process",
            inputSchema: {
              type: 'object',
              properties: {
                goal: {
                  type: 'string',
                  description: 'The primary goal the agent is trying to achieve',
                },
                initial_beliefs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Initial beliefs about the task and environment',
                  default: [],
                },
              },
              required: ['goal'],
            },
          },
          {
            name: 'stop_monitoring',
            description: 'Stop metacognitive monitoring and get session summary',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'process_trace_update',
            description:
              'Process a cognitive trace update from the agent (main monitoring function)',
            inputSchema: {
              type: 'object',
              properties: {
                recent_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of recent action names',
                },
                current_context: {
                  type: 'string',
                  description: 'Current environment context or state',
                },
                goal: {
                  type: 'string',
                  description: 'Current goal being pursued',
                },
                window_size: {
                  type: 'number',
                  description: 'Size of the monitoring window',
                  default: 10,
                },
              },
              required: ['recent_actions', 'goal'],
              additionalProperties: false,
            },
          },
          {
            name: 'detect_loop',
            description: 'Detect if the agent is stuck in a loop using various strategies',
            inputSchema: {
              type: 'object',
              properties: {
                recent_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recent actions to check for loops',
                },
                current_context: {
                  type: 'string',
                  description: 'Current environment context or state',
                },
                goal: {
                  type: 'string',
                  description: 'Current goal being pursued',
                },
                detection_method: {
                  type: 'string',
                  enum: ['statistical', 'pattern', 'hybrid'],
                  description: 'Loop detection method to use',
                  default: 'hybrid',
                },
              },
              required: ['recent_actions', 'goal'],
              additionalProperties: false,
            },
          },
          {
            name: 'diagnose_failure',
            description: 'Diagnose the cause of a detected loop using abductive reasoning',
            inputSchema: {
              type: 'object',
              properties: {
                loop_detected: { type: 'boolean', description: 'Whether a loop was detected' },
                loop_type: {
                  type: 'string',
                  enum: ['action_repetition', 'state_invariance', 'progress_stagnation'],
                  description: 'Type of loop detected',
                },
                loop_confidence: { type: 'number', description: 'Confidence in loop detection' },
                loop_details: { type: 'string', description: 'Details about the detected loop' },
                actions_involved: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Actions involved in the loop',
                },
                entropy_score: { type: 'number', description: 'Statistical entropy score' },
                variance_score: { type: 'number', description: 'Statistical variance score' },
                trend_score: { type: 'number', description: 'Statistical trend score' },
                cyclicity_score: { type: 'number', description: 'Statistical cyclicity score' },
                recent_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recent actions from trace',
                },
                current_context: {
                  type: 'string',
                  description: 'Current environment context or state',
                },
                goal: {
                  type: 'string',
                  description: 'Current goal being pursued',
                },
              },
              required: [
                'loop_detected',
                'loop_confidence',
                'loop_details',
                'recent_actions',
                'goal',
              ],
              additionalProperties: false,
            },
          },
          {
            name: 'revise_beliefs',
            description: 'Revise agent beliefs using AGM belief revision principles',
            inputSchema: {
              type: 'object',
              properties: {
                current_beliefs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Current beliefs as simple strings',
                },
                contradicting_evidence: {
                  type: 'string',
                  description: 'Evidence that contradicts current beliefs',
                },
                recent_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recent actions from trace',
                },
                goal: {
                  type: 'string',
                  description: 'Current goal being pursued',
                },
              },
              required: ['current_beliefs', 'contradicting_evidence', 'recent_actions', 'goal'],
              additionalProperties: false,
            },
          },
          {
            name: 'generate_recovery_plan',
            description: 'Generate a recovery plan using case-based reasoning',
            inputSchema: {
              type: 'object',
              properties: {
                primary_hypothesis: {
                  type: 'string',
                  enum: [
                    'element_state_error',
                    'page_state_error',
                    'selector_error',
                    'task_model_error',
                    'network_error',
                    'unknown',
                  ],
                  description: 'Primary hypothesis from diagnosis',
                },
                diagnosis_confidence: { type: 'number', description: 'Confidence in diagnosis' },
                evidence: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Evidence supporting the diagnosis',
                },
                suggested_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Suggested actions from diagnosis',
                },
                sentiment_score: { type: 'number', description: 'Semantic sentiment score' },
                confidence_factors: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Factors affecting confidence',
                },
                evidence_quality: { type: 'number', description: 'Quality of evidence' },
                recent_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Recent actions from trace',
                },
                current_context: {
                  type: 'string',
                  description: 'Current environment context or state',
                },
                goal: {
                  type: 'string',
                  description: 'Current goal being pursued',
                },
                available_patterns: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'strategic_retreat',
                      'context_refresh',
                      'modality_switching',
                      'information_foraging',
                      'human_escalation',
                    ],
                  },
                  description: 'Available recovery patterns',
                },
              },
              required: [
                'primary_hypothesis',
                'diagnosis_confidence',
                'evidence',
                'suggested_actions',
                'recent_actions',
                'goal',
              ],
              additionalProperties: false,
            },
          },
          {
            name: 'store_experience',
            description: 'Store a case for future case-based reasoning',
            inputSchema: {
              type: 'object',
              properties: {
                problem_description: {
                  type: 'string',
                  description: 'Simple description of the problem',
                },
                solution: {
                  type: 'string',
                  description: 'What action resolved the issue',
                },
                outcome: {
                  type: 'boolean',
                  description: 'Whether the solution was successful',
                },
              },
              required: ['problem_description', 'solution', 'outcome'],
              additionalProperties: false,
            },
          },
          {
            name: 'retrieve_similar_cases',
            description: 'Retrieve similar cases from the case base',
            inputSchema: {
              type: 'object',
              properties: {
                problem_description: {
                  type: 'string',
                  description: 'Description of current problem',
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of cases to return',
                  default: 5,
                },
              },
              required: ['problem_description'],
              additionalProperties: false,
            },
          },
          {
            name: 'get_monitoring_status',
            description: 'Get current monitoring status and statistics',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'update_recovery_outcome',
            description: 'Update the outcome of a recovery plan for learning',
            inputSchema: {
              type: 'object',
              properties: {
                successful: {
                  type: 'boolean',
                  description: 'Whether the recovery was successful',
                },
                explanation: {
                  type: 'string',
                  description: 'Explanation of the outcome',
                },
              },
              required: ['successful', 'explanation'],
            },
          },
          {
            name: 'reset_engine',
            description: 'Reset the dual-cycle engine state',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'configure_detection',
            description:
              'Configure loop detection parameters and domain-specific progress indicators',
            inputSchema: {
              type: 'object',
              properties: {
                progress_indicators: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Action patterns that indicate positive task progress (e.g., ["success", "complete", "found"])',
                  default: [],
                },
                min_actions_for_detection: {
                  type: 'number',
                  description: 'Minimum number of actions required before loop detection',
                  default: 5,
                },
                alternating_threshold: {
                  type: 'number',
                  description: 'Threshold for detecting alternating action patterns (0.0-1.0)',
                  default: 0.5,
                },
                repetition_threshold: {
                  type: 'number',
                  description: 'Threshold for detecting repetitive action patterns (0.0-1.0)',
                  default: 0.4,
                },
                progress_threshold_adjustment: {
                  type: 'number',
                  description:
                    'How much to increase thresholds when progress indicators are present',
                  default: 0.2,
                },
              },
              additionalProperties: false,
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'start_monitoring': {
            const { goal, initial_beliefs = [] } = args as any;
            this.engine.startMonitoring(goal, initial_beliefs);
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Metacognitive monitoring started for goal: "${goal}" with ${initial_beliefs.length} initial beliefs`,
                },
              ],
            };
          }

          case 'stop_monitoring': {
            const status = this.engine.getMonitoringStatus();
            this.engine.stopMonitoring();
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `🛑 Monitoring stopped. Session summary:\n` +
                    `- Goal: ${status.current_goal}\n` +
                    `- Total interventions: ${status.intervention_count}\n` +
                    `- Trace length: ${status.trace_length} actions`,
                },
              ],
            };
          }

          case 'process_trace_update': {
            const {
              recent_actions,
              current_context,
              goal,
              window_size = 10,
            } = MonitorCognitiveTraceInputSchema.parse(args);
            const trace = { recent_actions, current_context, goal };
            const result = await this.engine.processTraceUpdate(trace);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'detect_loop': {
            const {
              recent_actions,
              current_context,
              goal,
              detection_method = 'statistical',
            } = DetectLoopInputSchema.parse(args);
            const trace = { recent_actions, current_context, goal };
            // Direct access to sentinel for standalone loop detection
            const sentinel = (this.engine as any).sentinel;
            const result = sentinel.detectLoop(trace, detection_method);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'diagnose_failure': {
            const {
              loop_detected,
              loop_type,
              loop_confidence,
              loop_details,
              actions_involved,
              entropy_score,
              variance_score,
              trend_score,
              cyclicity_score,
              recent_actions,
              current_context,
              goal,
            } = DiagnoseFailureInputSchema.parse(args);

            const loop_result = {
              detected: loop_detected,
              type: loop_type,
              confidence: loop_confidence,
              details: loop_details,
              actions_involved,
              statistical_metrics: {
                entropy_score,
                variance_score,
                trend_score,
                cyclicity_score,
              },
            };

            const trace = { recent_actions, current_context, goal };
            const adjudicator = (this.engine as any).adjudicator;
            const result = await adjudicator.diagnoseFailure(loop_result, trace);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'revise_beliefs': {
            const { current_beliefs, contradicting_evidence, recent_actions, goal } =
              ReviseBelifsInputSchema.parse(args);
            const trace = { recent_actions, goal };
            const adjudicator = (this.engine as any).adjudicator;
            const result = await adjudicator.reviseBeliefs(
              current_beliefs,
              contradicting_evidence,
              trace
            );

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'generate_recovery_plan': {
            const {
              primary_hypothesis,
              diagnosis_confidence,
              evidence,
              suggested_actions,
              sentiment_score,
              confidence_factors,
              evidence_quality,
              recent_actions,
              current_context,
              goal,
              available_patterns,
            } = GenerateRecoveryPlanInputSchema.parse(args);

            const diagnosis = {
              primary_hypothesis,
              confidence: diagnosis_confidence,
              evidence,
              suggested_actions,
              semantic_analysis: {
                sentiment_score,
                confidence_factors,
                evidence_quality,
              },
            };

            const trace = { recent_actions, current_context, goal };
            const adjudicator = (this.engine as any).adjudicator;
            const result = adjudicator.generateRecoveryPlan(diagnosis, trace, available_patterns);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'store_experience': {
            const { problem_description, solution, outcome } =
              StoreExperienceInputSchema.parse(args);
            const caseData = { problem_description, solution, outcome };
            const adjudicator = (this.engine as any).adjudicator;
            const storedCase = CaseSchema.parse(caseData);
            adjudicator.storeExperience(storedCase);

            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Experience stored: Case ${storedCase.id || 'new'} added to case base`,
                },
              ],
            };
          }

          case 'retrieve_similar_cases': {
            const { problem_description, max_results = 5 } =
              RetrieveSimilarCasesInputSchema.parse(args);
            const result = this.engine.getSimilarCases(problem_description, max_results);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_monitoring_status': {
            const status = this.engine.getMonitoringStatus();

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(status, null, 2),
                },
              ],
            };
          }

          case 'update_recovery_outcome': {
            const { successful, explanation } = args as any;
            this.engine.updateRecoveryOutcome(successful, explanation);

            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Recovery outcome updated: ${successful ? 'SUCCESS' : 'FAILURE'} - ${explanation}`,
                },
              ],
            };
          }

          case 'reset_engine': {
            this.engine.reset();

            return {
              content: [
                {
                  type: 'text',
                  text: '🔄 Dual-Cycle Engine has been reset',
                },
              ],
            };
          }

          case 'configure_detection': {
            const newConfig = args as Partial<SentinelConfig>;
            this.config = { ...this.config, ...newConfig };

            // Update the engine's sentinel configuration
            (this.engine as any).sentinel.updateConfig(this.config);

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `⚙️ Detection configuration updated:\n` +
                    `- Progress indicators: [${this.config.progress_indicators?.join(', ') || 'none'}]\n` +
                    `- Min actions for detection: ${this.config.min_actions_for_detection}\n` +
                    `- Alternating threshold: ${this.config.alternating_threshold}\n` +
                    `- Repetition threshold: ${this.config.repetition_threshold}\n` +
                    `- Progress threshold adjustment: ${this.config.progress_threshold_adjustment}`,
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error in tool ${name}:`), errorMessage);

        return {
          content: [
            {
              type: 'text',
              text: `❌ Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error(chalk.red('MCP Server Error:'), error);
    };

    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down Dual-Cycle Reasoner MCP Server...'));
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();

    console.error(chalk.blue('🧠 Dual-Cycle Reasoner MCP Server starting...'));
    console.error(
      chalk.gray(
        'Implementing metacognitive framework for autonomous agent loop detection and recovery'
      )
    );
    console.error(
      chalk.gray(
        'Based on the Dual-Cycle cognitive architecture with Sentinel and Adjudicator components'
      )
    );

    await this.server.connect(transport);
    console.error(chalk.green('✅ Server ready for connections'));
  }
}

// Start the server
const server = new DualCycleReasonerServer();
server.run().catch((error) => {
  console.error(chalk.red('Failed to start server:'), error);
  process.exit(1);
});
