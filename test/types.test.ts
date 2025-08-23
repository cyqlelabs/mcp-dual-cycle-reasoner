import { z } from 'zod';
import {
  SentinelConfigSchema,
  AgentActionSchema,
  EnvironmentStateSchema,
  CognitiveTraceSchema,
  LoopTypeSchema,
  LoopDetectionResultSchema,
  CaseSchema,
  MonitorCognitiveTraceInputSchema,
  DetectLoopInputSchema,
  StoreExperienceInputSchema,
  RetrieveSimilarCasesInputSchema,
} from '../src/types.js';

describe('Type Schemas', () => {
  describe('SentinelConfigSchema', () => {
    it('should validate with default values', () => {
      const result = SentinelConfigSchema.parse({});

      expect(result.progress_indicators).toEqual([]);
      expect(result.min_actions_for_detection).toBe(5);
      expect(result.alternating_threshold).toBe(0.5);
      expect(result.repetition_threshold).toBe(0.4);
      expect(result.progress_threshold_adjustment).toBe(0.2);
      expect(result.semantic_intents).toEqual([
        'performing action',
        'checking status',
        'retrieving information',
        'processing data',
        'handling error',
        'completing task',
        'initiating process',
        'validating result',
        'organizing information',
        'communicating result',
      ]);
    });

    it('should validate with custom values', () => {
      const config = {
        progress_indicators: ['success', 'complete'],
        min_actions_for_detection: 3,
        alternating_threshold: 0.7,
        statistical_analysis: {
          entropy_threshold: 0.8,
          variance_threshold: 0.2,
        },
      };

      const result = SentinelConfigSchema.parse(config);
      expect(result.progress_indicators).toEqual(['success', 'complete']);
      expect(result.min_actions_for_detection).toBe(3);
      expect(result.statistical_analysis?.entropy_threshold).toBe(0.8);
    });

    it('should reject invalid threshold values', () => {
      expect(() =>
        SentinelConfigSchema.parse({
          alternating_threshold: 'invalid',
        })
      ).toThrow();
    });
  });

  describe('AgentActionSchema', () => {
    it('should validate basic action', () => {
      const action = {
        type: 'click_button',
      };

      const result = AgentActionSchema.parse(action);
      expect(result.type).toBe('click_button');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });

    it('should validate action with all fields', () => {
      const action = {
        type: 'scroll_down',
        timestamp: 1234567890,
        result: 'scrolled successfully',
      };

      const result = AgentActionSchema.parse(action);
      expect(result.type).toBe('scroll_down');
      expect(result.timestamp).toBe(1234567890);
      expect(result.result).toBe('scrolled successfully');
    });

    it('should require type field', () => {
      expect(() => AgentActionSchema.parse({})).toThrow();
    });
  });

  describe('EnvironmentStateSchema', () => {
    it('should validate with minimal data', () => {
      const result = EnvironmentStateSchema.parse({});
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });

    it('should validate with context', () => {
      const state = {
        context: 'homepage loaded',
        timestamp: 1234567890,
      };

      const result = EnvironmentStateSchema.parse(state);
      expect(result.context).toBe('homepage loaded');
      expect(result.timestamp).toBe(1234567890);
    });
  });

  describe('CognitiveTraceSchema', () => {
    it('should validate basic trace', () => {
      const trace = {
        last_action: 'click_button',
        goal: 'complete signup',
      };

      const result = CognitiveTraceSchema.parse(trace);
      expect(result.last_action).toBe('click_button');
      expect(result.goal).toBe('complete signup');
    });

    it('should validate trace with context', () => {
      const trace = {
        last_action: 'scroll_down',
        current_context: 'product page',
        goal: 'find pricing',
      };

      const result = CognitiveTraceSchema.parse(trace);
      expect(result.current_context).toBe('product page');
    });

    it('should require last_action and goal', () => {
      expect(() =>
        CognitiveTraceSchema.parse({
          last_action: 'test',
        })
      ).toThrow();

      expect(() =>
        CognitiveTraceSchema.parse({
          goal: 'test',
        })
      ).toThrow();
    });
  });

  describe('LoopTypeSchema', () => {
    it('should validate valid loop types', () => {
      expect(LoopTypeSchema.parse('action_repetition')).toBe('action_repetition');
      expect(LoopTypeSchema.parse('state_invariance')).toBe('state_invariance');
      expect(LoopTypeSchema.parse('progress_stagnation')).toBe('progress_stagnation');
    });

    it('should reject invalid loop types', () => {
      expect(() => LoopTypeSchema.parse('invalid_type')).toThrow();
      expect(() => LoopTypeSchema.parse('')).toThrow();
    });
  });

  describe('LoopDetectionResultSchema', () => {
    it('should validate basic loop result', () => {
      const result = {
        detected: false,
        confidence: 0.5,
        details: {},
      };

      const parsed = LoopDetectionResultSchema.parse(result);
      expect(parsed.detected).toBe(false);
      expect(parsed.confidence).toBe(0.5);
    });

    it('should validate complete loop result', () => {
      const result = {
        detected: true,
        type: 'action_repetition',
        confidence: 0.8,
        details: {
          dominant_method: 'pattern',
          anomaly_score: 0.9,
          actions_involved_count: 3,
        },
        actions_involved: ['scroll', 'click', 'scroll'],
        statistical_metrics: {
          entropy_score: 0.2,
          variance_score: 0.1,
        },
      };

      const parsed = LoopDetectionResultSchema.parse(result);
      expect(parsed.type).toBe('action_repetition');
      expect(parsed.actions_involved).toHaveLength(3);
      expect(parsed.statistical_metrics?.entropy_score).toBe(0.2);
    });

    it('should require detected and confidence fields', () => {
      expect(() =>
        LoopDetectionResultSchema.parse({
          confidence: 0.5,
          details: {},
        })
      ).toThrow();
    });
  });

  describe('CaseSchema', () => {
    it('should validate basic case', () => {
      const caseData = {
        problem_description: 'Login failed',
        solution: 'Reset password',
        outcome: true,
      };

      const result = CaseSchema.parse(caseData);
      expect(result.problem_description).toBe('Login failed');
      expect(result.solution).toBe('Reset password');
      expect(result.outcome).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.usage_count).toBe(0);
    });

    it('should validate case with metadata', () => {
      const caseData = {
        problem_description: 'API timeout',
        solution: 'Retry request',
        outcome: false,
        context: 'payment processing',
        difficulty_level: 'high' as const,
        success_rate: 0.7,
        confidence_score: 0.9,
      };

      const result = CaseSchema.parse(caseData);
      expect(result.difficulty_level).toBe('high');
      expect(result.success_rate).toBe(0.7);
      expect(result.confidence_score).toBe(0.9);
    });

    it('should validate case with semantic features', () => {
      const caseData = {
        problem_description: 'Navigation issue',
        solution: 'Use breadcrumbs',
        outcome: true,
        semantic_features: {
          intents: ['navigating', 'orienting'],
          sentiment: 'neutral' as const,
          keywords: ['navigation', 'menu', 'breadcrumb'],
        },
      };

      const result = CaseSchema.parse(caseData);
      expect(result.semantic_features?.intents).toContain('navigating');
      expect(result.semantic_features?.sentiment).toBe('neutral');
    });

    it('should require core fields', () => {
      expect(() =>
        CaseSchema.parse({
          solution: 'test',
          outcome: true,
        })
      ).toThrow();
    });
  });

  describe('Input Schemas for MCP Tools', () => {
    describe('MonitorCognitiveTraceInputSchema', () => {
      it('should validate with required fields', () => {
        const input = {
          last_action: 'click',
          goal: 'complete task',
        };

        const result = MonitorCognitiveTraceInputSchema.parse(input);
        expect(result.last_action).toBe('click');
        expect(result.goal).toBe('complete task');
        expect(result.window_size).toBe(10);
      });

      it('should validate with all fields', () => {
        const input = {
          last_action: 'scroll',
          current_context: 'homepage',
          goal: 'find info',
          window_size: 15,
        };

        const result = MonitorCognitiveTraceInputSchema.parse(input);
        expect(result.current_context).toBe('homepage');
        expect(result.window_size).toBe(15);
      });
    });

    describe('DetectLoopInputSchema', () => {
      it('should validate with minimal fields', () => {
        const input = {
          goal: 'test goal',
        };

        const result = DetectLoopInputSchema.parse(input);
        expect(result.goal).toBe('test goal');
        expect(result.detection_method).toBe('hybrid');
      });

      it('should validate detection methods', () => {
        ['statistical', 'pattern', 'hybrid'].forEach((method) => {
          const input = {
            goal: 'test',
            detection_method: method,
          };

          const result = DetectLoopInputSchema.parse(input);
          expect(result.detection_method).toBe(method);
        });
      });
    });

    describe('StoreExperienceInputSchema', () => {
      it('should validate basic experience', () => {
        const input = {
          problem_description: 'Issue occurred',
          solution: 'Fixed it',
          outcome: true,
        };

        const result = StoreExperienceInputSchema.parse(input);
        expect(result.problem_description).toBe('Issue occurred');
        expect(result.solution).toBe('Fixed it');
        expect(result.outcome).toBe(true);
      });

      it('should validate with optional fields', () => {
        const input = {
          problem_description: 'Complex issue',
          solution: 'Multi-step fix',
          outcome: false,
          context: 'production environment',
          difficulty_level: 'high' as const,
        };

        const result = StoreExperienceInputSchema.parse(input);
        expect(result.context).toBe('production environment');
        expect(result.difficulty_level).toBe('high');
      });
    });

    describe('RetrieveSimilarCasesInputSchema', () => {
      it('should validate with defaults', () => {
        const input = {
          problem_description: 'Similar issue',
        };

        const result = RetrieveSimilarCasesInputSchema.parse(input);
        expect(result.problem_description).toBe('Similar issue');
        expect(result.max_results).toBe(5);
        expect(result.min_similarity).toBe(0.1);
      });

      it('should validate with all filters', () => {
        const input = {
          problem_description: 'Test problem',
          max_results: 3,
          context_filter: 'test context',
          difficulty_filter: 'medium' as const,
          outcome_filter: true,
          min_similarity: 0.7,
        };

        const result = RetrieveSimilarCasesInputSchema.parse(input);
        expect(result.max_results).toBe(3);
        expect(result.context_filter).toBe('test context');
        expect(result.difficulty_filter).toBe('medium');
        expect(result.outcome_filter).toBe(true);
        expect(result.min_similarity).toBe(0.7);
      });

      it('should validate min_similarity range', () => {
        expect(() =>
          RetrieveSimilarCasesInputSchema.parse({
            problem_description: 'test',
            min_similarity: 1.5,
          })
        ).toThrow();

        expect(() =>
          RetrieveSimilarCasesInputSchema.parse({
            problem_description: 'test',
            min_similarity: -0.1,
          })
        ).toThrow();
      });
    });
  });

  describe('Schema relationships and consistency', () => {
    it('should have consistent difficulty levels across schemas', () => {
      const validLevels = ['low', 'medium', 'high'];

      validLevels.forEach((level) => {
        expect(() =>
          CaseSchema.parse({
            problem_description: 'test',
            solution: 'test',
            outcome: true,
            difficulty_level: level,
          })
        ).not.toThrow();

        expect(() =>
          StoreExperienceInputSchema.parse({
            problem_description: 'test',
            solution: 'test',
            outcome: true,
            difficulty_level: level,
          })
        ).not.toThrow();

        expect(() =>
          RetrieveSimilarCasesInputSchema.parse({
            problem_description: 'test',
            difficulty_filter: level,
          })
        ).not.toThrow();
      });
    });

    it('should have consistent sentiment values', () => {
      const validSentiments = ['positive', 'negative', 'neutral'];

      validSentiments.forEach((sentiment) => {
        expect(() =>
          CaseSchema.parse({
            problem_description: 'test',
            solution: 'test',
            outcome: true,
            semantic_features: {
              sentiment: sentiment,
            },
          })
        ).not.toThrow();
      });
    });
  });
});
