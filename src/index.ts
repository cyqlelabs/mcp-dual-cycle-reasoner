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
                trace: {
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
                    step_count: {
                      type: 'number',
                      description: 'Number of steps taken',
                      default: 1,
                    },
                  },
                  required: ['recent_actions', 'goal'],
                  additionalProperties: false,
                },
                window_size: {
                  type: 'number',
                  description: 'Size of the monitoring window',
                  default: 10,
                },
              },
              required: ['trace'],
              additionalProperties: false,
            },
          },
          {
            name: 'detect_loop',
            description: 'Detect if the agent is stuck in a loop using various strategies',
            inputSchema: {
              type: 'object',
              properties: {
                trace: {
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
                    step_count: {
                      type: 'number',
                      description: 'Number of steps taken',
                      default: 1,
                    },
                  },
                  required: ['recent_actions', 'goal'],
                  additionalProperties: false,
                },
                detection_method: {
                  type: 'string',
                  enum: ['statistical', 'pattern', 'hybrid'],
                  description: 'Loop detection method to use',
                  default: 'hybrid',
                },
              },
              required: ['trace'],
              additionalProperties: false,
            },
          },
          {
            name: 'diagnose_failure',
            description: 'Diagnose the cause of a detected loop using abductive reasoning',
            inputSchema: {
              type: 'object',
              properties: {
                loop_result: {
                  type: 'object',
                  properties: {
                    detected: { type: 'boolean' },
                    type: {
                      type: 'string',
                      enum: ['action_repetition', 'state_invariance', 'progress_stagnation'],
                    },
                    confidence: { type: 'number' },
                    details: { type: 'string' },
                    actions_involved: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    statistical_metrics: {
                      type: 'object',
                      properties: {
                        entropy_score: { type: 'number' },
                        variance_score: { type: 'number' },
                        trend_score: { type: 'number' },
                        cyclicity_score: { type: 'number' },
                      },
                      additionalProperties: false,
                    },
                  },
                  required: ['detected', 'confidence', 'details'],
                  additionalProperties: false,
                },
                trace: {
                  type: 'object',
                  properties: {
                    recent_actions: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    current_context: {
                      type: 'string',
                      description: 'Current environment context or state',
                    },
                    goal: {
                      type: 'string',
                    },
                  },
                  required: ['recent_actions', 'goal'],
                  additionalProperties: false,
                },
              },
              required: ['loop_result', 'trace'],
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
                trace: {
                  type: 'object',
                  properties: {
                    recent_actions: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    goal: {
                      type: 'string',
                    },
                  },
                  required: ['recent_actions', 'goal'],
                  additionalProperties: false,
                },
              },
              required: ['current_beliefs', 'contradicting_evidence', 'trace'],
              additionalProperties: false,
            },
          },
          {
            name: 'generate_recovery_plan',
            description: 'Generate a recovery plan using case-based reasoning',
            inputSchema: {
              type: 'object',
              properties: {
                diagnosis: {
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
                    },
                    confidence: { type: 'number' },
                    evidence: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    suggested_actions: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    semantic_analysis: {
                      type: 'object',
                      properties: {
                        sentiment_score: { type: 'number' },
                        confidence_factors: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                        evidence_quality: { type: 'number' },
                      },
                      additionalProperties: false,
                    },
                  },
                  required: ['primary_hypothesis', 'confidence', 'evidence', 'suggested_actions'],
                  additionalProperties: false,
                },
                trace: {
                  type: 'object',
                  properties: {
                    recent_actions: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    current_context: {
                      type: 'string',
                      description: 'Current environment context or state',
                    },
                    goal: {
                      type: 'string',
                    },
                  },
                  required: ['recent_actions', 'goal'],
                  additionalProperties: false,
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
              required: ['diagnosis', 'trace'],
              additionalProperties: false,
            },
          },
          {
            name: 'store_experience',
            description: 'Store a case for future case-based reasoning',
            inputSchema: {
              type: 'object',
              properties: {
                case: {
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
              required: ['case'],
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
            const { trace } = MonitorCognitiveTraceInputSchema.parse(args);
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
            const { trace, detection_method = 'statistical' } = DetectLoopInputSchema.parse(args);
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
            const { loop_result, trace } = DiagnoseFailureInputSchema.parse(args);
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
            const { current_beliefs, contradicting_evidence, trace } =
              ReviseBelifsInputSchema.parse(args);
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
            const { diagnosis, trace, available_patterns } =
              GenerateRecoveryPlanInputSchema.parse(args);
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
            const { case: caseData } = StoreExperienceInputSchema.parse(args);
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
