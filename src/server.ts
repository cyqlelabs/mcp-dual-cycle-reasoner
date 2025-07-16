#!/usr/bin/env node

import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
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
import { DESCRIPTIONS } from './constants.js';
import chalk from 'chalk';

/**
 * MCP Server implementing the Dual-Cycle Metacognitive Reasoning Framework
 * Built with FastMCP for SSE transport support
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
  private server: FastMCP;
  private engine: DualCycleEngine;
  private config: Partial<SentinelConfig>;

  constructor() {
    this.server = new FastMCP({
      name: 'dual-cycle-reasoner',
      version: '1.2.1',
      instructions: `This MCP server implements the Dual-Cycle Metacognitive Reasoning Framework for autonomous agents.

Key capabilities:
- Monitor cognitive processes and detect when agents are stuck in loops
- Diagnose failure causes using abductive reasoning
- Generate recovery plans using case-based reasoning
- Maintain belief consistency using AGM belief revision
- Learn from experience through case storage and retrieval

The server follows a two-cycle architecture:
1. Sentinel (monitoring): Detects loops and cognitive failures
2. Adjudicator (control): Diagnoses problems and generates recovery plans

Use this server to help autonomous agents become more self-aware and resilient.`,

      // Configure health check endpoint
      health: {
        enabled: true,
        message: 'Dual-Cycle Reasoner MCP Server is healthy',
        path: '/health',
        status: 200,
      },

      // Configure ping behavior for connection health
      ping: {
        enabled: true,
        intervalMs: 30000, // 30 seconds for long-running cognitive tasks
        logLevel: 'debug',
      },

      // Enable roots support for file system integration
      roots: {
        enabled: true,
      },
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Default configuration - domain-agnostic
    this.config = {
      progress_indicators: [],
      min_actions_for_detection: 5,
      alternating_threshold: 0.5,
      repetition_threshold: 0.4,
      progress_threshold_adjustment: 0.2,
    };

    this.engine = new DualCycleEngine(this.config);
    this.setupTools();
    this.setupErrorHandling();
  }

  private setupEventHandlers(): void {
    // Handle client connections
    this.server.on('connect', (event) => {
      console.log(
        chalk.green(`🔗 Client connected: ${event.session.clientCapabilities?.name || 'unknown'}`)
      );

      // Listen for roots changes
      event.session.on('rootsChanged', (rootsEvent) => {
        console.log(chalk.blue('📁 Roots changed:'), rootsEvent.roots);
      });

      // Listen for session errors
      event.session.on('error', (errorEvent) => {
        console.error(chalk.red('❌ Session error:'), errorEvent.error);
      });
    });

    // Handle client disconnections
    this.server.on('disconnect', (event) => {
      console.log(
        chalk.yellow(
          `🔌 Client disconnected: ${event.session.clientCapabilities?.name || 'unknown'}`
        )
      );
    });
  }

  private async initializeSemanticAnalyzer(): Promise<void> {
    try {
      await semanticAnalyzer.initialize();
      console.log(chalk.green('✓ Semantic analyzer initialized successfully'));
    } catch (error) {
      console.error(chalk.red('✗ Failed to initialize semantic analyzer:'), error);
    }
  }

  private setupTools(): void {
    // Add all tools to the FastMCP server
    this.addStartMonitoringTool();
    this.addStopMonitoringTool();
    this.addProcessTraceUpdateTool();
    this.addDetectLoopTool();
    this.addDiagnoseFailureTool();
    this.addReviseBeliefsTool();
    this.addGenerateRecoveryPlanTool();
    this.addStoreExperienceTool();
    this.addRetrieveSimilarCasesTool();
    this.addGetMonitoringStatusTool();
    this.addUpdateRecoveryOutcomeTool();
    this.addResetEngineTool();
    this.addConfigureDetectionTool();
  }

  private addStartMonitoringTool(): void {
    this.server.addTool({
      name: 'start_monitoring',
      description: "Start metacognitive monitoring of an agent's cognitive process",
      parameters: z.object({
        goal: z.string().describe(DESCRIPTIONS.GOAL),
        initial_beliefs: z
          .array(z.string())
          .optional()
          .default([])
          .describe(DESCRIPTIONS.INITIAL_BELIEFS),
      }),
      annotations: {
        title: 'Start Metacognitive Monitoring',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          log.info('Starting metacognitive monitoring', {
            goal: args.goal,
            initialBeliefsCount: args.initial_beliefs.length,
          });

          this.engine.startMonitoring(args.goal, args.initial_beliefs);

          log.info('Monitoring started successfully');
          return `✅ Metacognitive monitoring started for goal: "${args.goal}" with ${args.initial_beliefs.length} initial beliefs`;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to start monitoring', { error: errorMessage });
          throw new UserError(`Failed to start monitoring: ${errorMessage}`);
        }
      },
    });
  }

  private addStopMonitoringTool(): void {
    this.server.addTool({
      name: 'stop_monitoring',
      description: 'Stop metacognitive monitoring and get session summary',
      parameters: z.object({}),
      annotations: {
        title: 'Stop Metacognitive Monitoring',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          const status = this.engine.getMonitoringStatus();

          log.info('Stopping monitoring', {
            goal: status.current_goal,
            interventions: status.intervention_count,
            traceLength: status.trace_length,
          });

          this.engine.stopMonitoring();

          return (
            `🛑 Monitoring stopped. Session summary:\n` +
            `- Goal: ${status.current_goal}\n` +
            `- Total interventions: ${status.intervention_count}\n` +
            `- Trace length: ${status.trace_length} actions`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to stop monitoring', { error: errorMessage });
          throw new UserError(`Failed to stop monitoring: ${errorMessage}`);
        }
      },
    });
  }

  private addProcessTraceUpdateTool(): void {
    this.server.addTool({
      name: 'process_trace_update',
      description: 'Process a cognitive trace update from the agent (main monitoring function)',
      parameters: z.object({
        last_action: z.string().describe(DESCRIPTIONS.LAST_ACTION),
        current_context: z
          .string()
          .optional()
          .describe(
            `${DESCRIPTIONS.CURRENT_CONTEXT}, in low dash format. Example: adding_product_item`
          ),
        goal: z.string().describe(DESCRIPTIONS.GOAL),
        window_size: z.number().optional().default(10).describe(DESCRIPTIONS.WINDOW_SIZE),
      }),
      annotations: {
        title: 'Process Cognitive Trace Update',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log, reportProgress }) => {
        try {
          const validatedArgs = MonitorCognitiveTraceInputSchema.parse(args);

          log.info('Processing trace update', {
            lastAction: validatedArgs.last_action,
            context: validatedArgs.current_context,
            goal: validatedArgs.goal,
          });

          await reportProgress({ progress: 0, total: 3 });

          const result = await this.engine.processTraceUpdate(
            validatedArgs.last_action,
            validatedArgs.current_context,
            validatedArgs.goal
          );

          await reportProgress({ progress: 3, total: 3 });

          log.info('Trace update processed', {
            loopDetected: result.loop_detected,
            interventionRequired: result.intervention_required,
          });

          return JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to process trace update', { error: errorMessage });
          throw new UserError(`Failed to process trace update: ${errorMessage}`);
        }
      },
    });
  }

  private addDetectLoopTool(): void {
    this.server.addTool({
      name: 'detect_loop',
      description: 'Detect if the agent is stuck in a loop using various strategies',
      parameters: z.object({
        current_context: z
          .string()
          .optional()
          .describe(`${DESCRIPTIONS.CURRENT_CONTEXT}, in low dash format. Example: sending_email`),
        goal: z.string().describe(DESCRIPTIONS.GOAL),
        detection_method: z
          .enum(['statistical', 'pattern', 'hybrid'])
          .optional()
          .default('hybrid')
          .describe(DESCRIPTIONS.DETECTION_METHOD),
      }),
      annotations: {
        title: 'Detect Cognitive Loop',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, reportProgress }) => {
        try {
          const validatedArgs = DetectLoopInputSchema.parse(args);

          log.info('Starting loop detection', {
            context: validatedArgs.current_context,
            goal: validatedArgs.goal,
            method: validatedArgs.detection_method,
          });

          await reportProgress({ progress: 0, total: 2 });

          // Get current enriched trace (includes recent_actions) and update context/goal if provided
          const enrichedTrace = this.engine.getEnrichedCurrentTrace();
          const trace = {
            ...enrichedTrace,
            ...(validatedArgs.current_context && {
              current_context: validatedArgs.current_context,
            }),
            ...(validatedArgs.goal && { goal: validatedArgs.goal }),
          };

          log.debug('Loop detection trace analysis', {
            recent_actions: trace.recent_actions,
            recent_actions_length: trace.recent_actions?.length,
            current_context: trace.current_context,
            goal: trace.goal,
          });

          await reportProgress({ progress: 1, total: 2 });

          // Direct access to sentinel for standalone loop detection
          const sentinel = (this.engine as any).sentinel;
          const result = sentinel.detectLoop(trace, validatedArgs.detection_method);

          await reportProgress({ progress: 2, total: 2 });

          log.info('Loop detection completed', {
            detected: result.detected,
            confidence: result.confidence,
            type: result.type,
          });

          return JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to detect loop', { error: errorMessage });
          throw new UserError(`Failed to detect loop: ${errorMessage}`);
        }
      },
    });
  }

  private addDiagnoseFailureTool(): void {
    this.server.addTool({
      name: 'diagnose_failure',
      description: 'Diagnose the cause of a detected loop using abductive reasoning',
      parameters: z.object({
        loop_detected: z.boolean().describe(DESCRIPTIONS.LOOP_DETECTED),
        loop_type: z
          .enum(['action_repetition', 'state_invariance', 'progress_stagnation'])
          .optional()
          .describe(DESCRIPTIONS.LOOP_TYPE),
        loop_confidence: z.number().describe(DESCRIPTIONS.LOOP_CONFIDENCE),
        loop_details: z.string().describe(DESCRIPTIONS.LOOP_DETAILS),
        actions_involved: z.array(z.string()).optional().describe(DESCRIPTIONS.ACTIONS_INVOLVED),
        entropy_score: z.number().optional().describe(DESCRIPTIONS.ENTROPY_SCORE),
        variance_score: z.number().optional().describe(DESCRIPTIONS.VARIANCE_SCORE),
        trend_score: z.number().optional().describe(DESCRIPTIONS.TREND_SCORE),
        cyclicity_score: z.number().optional().describe(DESCRIPTIONS.CYCLICITY_SCORE),
        current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
        goal: z.string().describe(DESCRIPTIONS.GOAL),
      }),
      annotations: {
        title: 'Diagnose Failure Cause',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, reportProgress }) => {
        try {
          const validatedArgs = DiagnoseFailureInputSchema.parse(args);

          log.info('Starting failure diagnosis', {
            loopDetected: validatedArgs.loop_detected,
            loopType: validatedArgs.loop_type,
            confidence: validatedArgs.loop_confidence,
          });

          await reportProgress({ progress: 0, total: 3 });

          const loop_result = {
            detected: validatedArgs.loop_detected,
            type: validatedArgs.loop_type,
            confidence: validatedArgs.loop_confidence,
            details: validatedArgs.loop_details,
            actions_involved: validatedArgs.actions_involved,
            statistical_metrics: {
              entropy_score: validatedArgs.entropy_score,
              variance_score: validatedArgs.variance_score,
              trend_score: validatedArgs.trend_score,
              cyclicity_score: validatedArgs.cyclicity_score,
            },
          };

          await reportProgress({ progress: 1, total: 3 });

          // Get current enriched trace (includes recent_actions) and update context/goal if provided
          const enrichedTrace = this.engine.getEnrichedCurrentTrace();
          const trace = {
            ...enrichedTrace,
            ...(validatedArgs.current_context && {
              current_context: validatedArgs.current_context,
            }),
            ...(validatedArgs.goal && { goal: validatedArgs.goal }),
          };

          log.debug('Analyzing trace for failure diagnosis', {
            actionsInvolved: validatedArgs.actions_involved,
            statisticalMetrics: loop_result.statistical_metrics,
          });

          const adjudicator = (this.engine as any).adjudicator;
          const result = await adjudicator.diagnoseFailure(loop_result, trace);

          await reportProgress({ progress: 3, total: 3 });

          log.info('Failure diagnosis completed', {
            primaryHypothesis: result.primary_hypothesis,
            confidence: result.confidence,
            evidenceCount: result.evidence?.length || 0,
          });

          return JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to diagnose failure', { error: errorMessage });
          throw new UserError(`Failed to diagnose failure: ${errorMessage}`);
        }
      },
    });
  }

  private addReviseBeliefsTool(): void {
    this.server.addTool({
      name: 'revise_beliefs',
      description: 'Revise agent beliefs using AGM belief revision principles',
      parameters: z.object({
        current_beliefs: z.array(z.string()).describe(DESCRIPTIONS.CURRENT_BELIEFS),
        contradicting_evidence: z.string().describe(DESCRIPTIONS.CONTRADICTING_EVIDENCE),
        goal: z.string().describe(DESCRIPTIONS.GOAL),
      }),
      annotations: {
        title: 'Revise Agent Beliefs',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log, reportProgress }) => {
        try {
          const validatedArgs = ReviseBelifsInputSchema.parse(args);

          log.info('Starting belief revision', {
            currentBeliefsCount: validatedArgs.current_beliefs.length,
            contradictingEvidence: validatedArgs.contradicting_evidence,
            goal: validatedArgs.goal,
          });

          await reportProgress({ progress: 0, total: 2 });

          // Get current trace and update goal if provided
          const currentTrace = this.engine.getCurrentTrace();
          const trace = {
            ...currentTrace,
            ...(validatedArgs.goal && { goal: validatedArgs.goal }),
          };

          log.debug('Analyzing beliefs for revision', {
            currentBeliefs: validatedArgs.current_beliefs,
            traceAvailable: !!currentTrace,
          });

          const adjudicator = (this.engine as any).adjudicator;
          const result = await adjudicator.reviseBeliefs(
            validatedArgs.current_beliefs,
            validatedArgs.contradicting_evidence,
            trace
          );

          await reportProgress({ progress: 2, total: 2 });

          log.info('Belief revision completed', {
            revisedBeliefsCount: result.revised_beliefs?.length || 0,
            retainedBeliefsCount: result.retained_beliefs?.length || 0,
            removedBeliefsCount: result.removed_beliefs?.length || 0,
          });

          return JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to revise beliefs', { error: errorMessage });
          throw new UserError(`Failed to revise beliefs: ${errorMessage}`);
        }
      },
    });
  }

  private addGenerateRecoveryPlanTool(): void {
    this.server.addTool({
      name: 'generate_recovery_plan',
      description: 'Generate a recovery plan using case-based reasoning',
      parameters: z.object({
        primary_hypothesis: z
          .enum([
            'element_state_error',
            'page_state_error',
            'selector_error',
            'task_model_error',
            'network_error',
            'unknown',
          ])
          .describe(DESCRIPTIONS.PRIMARY_HYPOTHESIS),
        diagnosis_confidence: z.number().describe(DESCRIPTIONS.DIAGNOSIS_CONFIDENCE),
        evidence: z.array(z.string()).describe(DESCRIPTIONS.EVIDENCE),
        suggested_actions: z.array(z.string()).describe(DESCRIPTIONS.SUGGESTED_ACTIONS),
        sentiment_score: z.number().optional().describe(DESCRIPTIONS.SENTIMENT_SCORE),
        confidence_factors: z
          .array(z.string())
          .optional()
          .describe(DESCRIPTIONS.CONFIDENCE_FACTORS),
        evidence_quality: z.number().optional().describe(DESCRIPTIONS.EVIDENCE_QUALITY),
        last_action: z.string().describe(DESCRIPTIONS.LAST_ACTION),
        current_context: z.string().optional().describe(DESCRIPTIONS.CURRENT_CONTEXT),
        goal: z.string().describe(DESCRIPTIONS.GOAL),
        available_patterns: z
          .array(
            z.enum([
              'strategic_retreat',
              'context_refresh',
              'modality_switching',
              'information_foraging',
              'human_escalation',
            ])
          )
          .optional()
          .describe(DESCRIPTIONS.AVAILABLE_PATTERNS),
      }),
      annotations: {
        title: 'Generate Recovery Plan',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log, reportProgress }) => {
        try {
          const validatedArgs = GenerateRecoveryPlanInputSchema.parse(args);

          log.info('Starting recovery plan generation', {
            primaryHypothesis: validatedArgs.primary_hypothesis,
            confidence: validatedArgs.diagnosis_confidence,
            evidenceCount: validatedArgs.evidence.length,
            availablePatterns: validatedArgs.available_patterns,
          });

          await reportProgress({ progress: 0, total: 3 });

          const diagnosis = {
            primary_hypothesis: validatedArgs.primary_hypothesis,
            confidence: validatedArgs.diagnosis_confidence,
            evidence: validatedArgs.evidence,
            suggested_actions: validatedArgs.suggested_actions,
            semantic_analysis: {
              sentiment_score: validatedArgs.sentiment_score,
              confidence_factors: validatedArgs.confidence_factors,
              evidence_quality: validatedArgs.evidence_quality,
            },
          };

          await reportProgress({ progress: 1, total: 3 });

          // Get current trace and update context/goal if provided
          const currentTrace = this.engine.getCurrentTrace();
          const trace = {
            ...currentTrace,
            ...(validatedArgs.current_context && {
              current_context: validatedArgs.current_context,
            }),
            ...(validatedArgs.goal && { goal: validatedArgs.goal }),
          };

          log.debug('Generating recovery plan with case-based reasoning', {
            context: validatedArgs.current_context,
            suggestedActionsCount: validatedArgs.suggested_actions.length,
            evidenceCount: validatedArgs.evidence.length,
          });

          const adjudicator = (this.engine as any).adjudicator;
          const result = adjudicator.generateRecoveryPlan(
            diagnosis,
            trace,
            validatedArgs.available_patterns
          );

          await reportProgress({ progress: 3, total: 3 });

          log.info('Recovery plan generated', {
            strategyPattern: result.strategy_pattern,
            actionsCount: result.actions?.length || 0,
            confidence: result.confidence,
            reasoningApproach: result.reasoning_approach,
          });

          return JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to generate recovery plan', { error: errorMessage });
          throw new UserError(`Failed to generate recovery plan: ${errorMessage}`);
        }
      },
    });
  }

  private addStoreExperienceTool(): void {
    this.server.addTool({
      name: 'store_experience',
      description: 'Store a case for future case-based reasoning',
      parameters: z.object({
        problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
        solution: z.string().describe(DESCRIPTIONS.SOLUTION),
        outcome: z.boolean().describe(DESCRIPTIONS.OUTCOME),
      }),
      annotations: {
        title: 'Store Experience Case',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          const validatedArgs = StoreExperienceInputSchema.parse(args);

          log.info('Storing experience case', {
            problemDescription: validatedArgs.problem_description,
            solution: validatedArgs.solution,
            outcome: validatedArgs.outcome,
          });

          const caseData = {
            problem_description: validatedArgs.problem_description,
            solution: validatedArgs.solution,
            outcome: validatedArgs.outcome,
          };

          const adjudicator = (this.engine as any).adjudicator;
          const storedCase = CaseSchema.parse(caseData);
          adjudicator.storeExperience(storedCase);

          log.info('Experience case stored successfully', {
            caseId: storedCase.id || 'new',
            outcome: storedCase.outcome ? 'success' : 'failure',
          });

          return `✅ Experience stored: Case ${storedCase.id || 'new'} added to case base`;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to store experience', { error: errorMessage });
          throw new UserError(`Failed to store experience: ${errorMessage}`);
        }
      },
    });
  }

  private addRetrieveSimilarCasesTool(): void {
    this.server.addTool({
      name: 'retrieve_similar_cases',
      description: 'Retrieve similar cases from the case base',
      parameters: z.object({
        problem_description: z.string().describe(DESCRIPTIONS.PROBLEM_DESCRIPTION),
        max_results: z.number().optional().default(5).describe(DESCRIPTIONS.MAX_RESULTS),
      }),
      annotations: {
        title: 'Retrieve Similar Cases',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log, reportProgress }) => {
        try {
          const validatedArgs = RetrieveSimilarCasesInputSchema.parse(args);

          log.info('Retrieving similar cases', {
            problemDescription: validatedArgs.problem_description,
            maxResults: validatedArgs.max_results,
          });

          await reportProgress({ progress: 0, total: 2 });

          const result = this.engine.getSimilarCases(
            validatedArgs.problem_description,
            validatedArgs.max_results
          );

          await reportProgress({ progress: 2, total: 2 });

          log.info('Similar cases retrieved', {
            casesFound: result.length,
            maxResults: validatedArgs.max_results,
          });

          return JSON.stringify(result, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to retrieve similar cases', { error: errorMessage });
          throw new UserError(`Failed to retrieve similar cases: ${errorMessage}`);
        }
      },
    });
  }

  private addGetMonitoringStatusTool(): void {
    this.server.addTool({
      name: 'get_monitoring_status',
      description: 'Get current monitoring status and statistics',
      parameters: z.object({}),
      annotations: {
        title: 'Get Monitoring Status',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          log.debug('Retrieving monitoring status');

          const status = this.engine.getMonitoringStatus();

          log.info('Monitoring status retrieved', {
            isMonitoring: status.is_monitoring,
            currentGoal: status.current_goal,
            traceLength: status.trace_length,
            interventionCount: status.intervention_count,
          });

          return JSON.stringify(status, null, 2);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to get monitoring status', { error: errorMessage });
          throw new UserError(`Failed to get monitoring status: ${errorMessage}`);
        }
      },
    });
  }

  private addUpdateRecoveryOutcomeTool(): void {
    this.server.addTool({
      name: 'update_recovery_outcome',
      description: 'Update the outcome of a recovery plan for learning',
      parameters: z.object({
        successful: z.boolean().describe(DESCRIPTIONS.SUCCESSFUL),
        explanation: z.string().describe(DESCRIPTIONS.EXPLANATION),
      }),
      annotations: {
        title: 'Update Recovery Outcome',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          log.info('Updating recovery outcome', {
            successful: args.successful,
            explanation: args.explanation,
          });

          this.engine.updateRecoveryOutcome(args.successful, args.explanation);

          log.info('Recovery outcome updated successfully', {
            outcome: args.successful ? 'SUCCESS' : 'FAILURE',
          });

          return `✅ Recovery outcome updated: ${args.successful ? 'SUCCESS' : 'FAILURE'} - ${args.explanation}`;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to update recovery outcome', { error: errorMessage });
          throw new UserError(`Failed to update recovery outcome: ${errorMessage}`);
        }
      },
    });
  }

  private addResetEngineTool(): void {
    this.server.addTool({
      name: 'reset_engine',
      description: 'Reset the dual-cycle engine state',
      parameters: z.object({}),
      annotations: {
        title: 'Reset Engine State',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          log.warn('Resetting dual-cycle engine state');

          this.engine.reset();

          log.info('Engine reset completed successfully');

          return '🔄 Dual-Cycle Engine has been reset';
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to reset engine', { error: errorMessage });
          throw new UserError(`Failed to reset engine: ${errorMessage}`);
        }
      },
    });
  }

  private addConfigureDetectionTool(): void {
    this.server.addTool({
      name: 'configure_detection',
      description: 'Configure loop detection parameters and domain-specific progress indicators',
      parameters: z.object({
        progress_indicators: z
          .array(z.string())
          .optional()
          .default([])
          .describe(DESCRIPTIONS.PROGRESS_INDICATORS),
        min_actions_for_detection: z
          .number()
          .optional()
          .default(5)
          .describe(DESCRIPTIONS.MIN_ACTIONS_FOR_DETECTION),
        alternating_threshold: z
          .number()
          .optional()
          .default(0.5)
          .describe(DESCRIPTIONS.ALTERNATING_THRESHOLD),
        repetition_threshold: z
          .number()
          .optional()
          .default(0.4)
          .describe(DESCRIPTIONS.REPETITION_THRESHOLD),
        progress_threshold_adjustment: z
          .number()
          .optional()
          .default(0.2)
          .describe(DESCRIPTIONS.PROGRESS_THRESHOLD_ADJUSTMENT),
      }),
      annotations: {
        title: 'Configure Detection Parameters',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: async (args, { log }) => {
        try {
          const newConfig = args as Partial<SentinelConfig>;

          log.info('Updating detection configuration', {
            progressIndicators: newConfig.progress_indicators,
            minActionsForDetection: newConfig.min_actions_for_detection,
            alternatingThreshold: newConfig.alternating_threshold,
            repetitionThreshold: newConfig.repetition_threshold,
            progressThresholdAdjustment: newConfig.progress_threshold_adjustment,
          });

          this.config = { ...this.config, ...newConfig };

          // Update the engine's sentinel configuration
          (this.engine as any).sentinel.updateConfig(this.config);

          log.info('Detection configuration updated successfully', {
            configKeys: Object.keys(newConfig),
          });

          return (
            `⚙️ Detection configuration updated:\n` +
            `- Progress indicators: [${this.config.progress_indicators?.join(', ') || 'none'}]\n` +
            `- Min actions for detection: ${this.config.min_actions_for_detection}\n` +
            `- Alternating threshold: ${this.config.alternating_threshold}\n` +
            `- Repetition threshold: ${this.config.repetition_threshold}\n` +
            `- Progress threshold adjustment: ${this.config.progress_threshold_adjustment}`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('Failed to configure detection parameters', { error: errorMessage });
          throw new UserError(`Failed to configure detection parameters: ${errorMessage}`);
        }
      },
    });
  }

  private setupErrorHandling(): void {
    // Handle process signals
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down Dual-Cycle Reasoner MCP Server...'));
      await this.server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down Dual-Cycle Reasoner MCP Server...'));
      await this.server.stop();
      process.exit(0);
    });
  }

  async start(options?: { transportType?: 'stdio' | 'httpStream'; port?: number }): Promise<void> {
    const { transportType = 'httpStream', port = 8080 } = options || {};

    console.log(chalk.blue('🧠 Dual-Cycle Reasoner MCP Server starting...'));
    console.log(
      chalk.gray(
        'Implementing metacognitive framework for autonomous agent loop detection and recovery'
      )
    );
    console.log(
      chalk.gray(
        'Based on the Dual-Cycle cognitive architecture with Sentinel and Adjudicator components'
      )
    );

    // Initialize semantic analyzer before starting server
    await this.initializeSemanticAnalyzer();

    if (transportType === 'stdio') {
      console.log(chalk.cyan('📡 Using stdio transport'));
      await this.server.start({ transportType: 'stdio' });
    } else {
      console.log(chalk.cyan(`📡 Using HTTP Stream transport with SSE on port ${port}`));
      console.log(chalk.gray(`🌐 Server endpoints:`));
      console.log(chalk.gray(`  - HTTP Stream: http://localhost:${port}/mcp`));
      console.log(chalk.gray(`  - SSE: http://localhost:${port}/sse`));
      console.log(chalk.gray(`  - Health Check: http://localhost:${port}/health`));

      await this.server.start({
        transportType: 'httpStream',
        httpStream: { port },
      });
    }

    console.log(chalk.green('✅ Server ready for connections'));
  }

  async stop(): Promise<void> {
    await this.server.stop();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const transportType = args.includes('--stdio') ? 'stdio' : 'httpStream';
const portArg = args.find((arg) => arg.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1]) : 8080;

// Start the server
const server = new DualCycleReasonerServer();
server.start({ transportType, port }).catch((error) => {
  console.error(chalk.red('Failed to start server:'), error);
  process.exit(1);
});
