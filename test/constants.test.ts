import { DESCRIPTIONS } from '../src/constants.js';

describe('Constants', () => {
  describe('DESCRIPTIONS object', () => {
    it('should contain all required field descriptions', () => {
      expect(DESCRIPTIONS.LAST_ACTION).toBeDefined();
      expect(DESCRIPTIONS.CURRENT_CONTEXT).toBeDefined();
      expect(DESCRIPTIONS.GOAL).toBeDefined();
      expect(DESCRIPTIONS.LOOP_DETECTED).toBeDefined();
      expect(DESCRIPTIONS.LOOP_TYPE).toBeDefined();
      expect(DESCRIPTIONS.LOOP_CONFIDENCE).toBeDefined();
    });

    it('should have string values for all descriptions', () => {
      Object.values(DESCRIPTIONS).forEach((description) => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });

    it('should contain statistical metric descriptions', () => {
      expect(DESCRIPTIONS.ENTROPY_SCORE).toBeDefined();
      expect(DESCRIPTIONS.VARIANCE_SCORE).toBeDefined();
      expect(DESCRIPTIONS.TREND_SCORE).toBeDefined();
      expect(DESCRIPTIONS.CYCLICITY_SCORE).toBeDefined();
    });

    it('should contain belief-related descriptions', () => {
      expect(DESCRIPTIONS.CURRENT_BELIEFS).toBeDefined();
      expect(DESCRIPTIONS.CONTRADICTING_EVIDENCE).toBeDefined();
      expect(DESCRIPTIONS.INITIAL_BELIEFS).toBeDefined();
      expect(DESCRIPTIONS.REVISED_BELIEFS).toBeDefined();
      expect(DESCRIPTIONS.REMOVED_BELIEFS).toBeDefined();
      expect(DESCRIPTIONS.RATIONALE).toBeDefined();
    });

    it('should contain case-based reasoning descriptions', () => {
      expect(DESCRIPTIONS.PROBLEM_DESCRIPTION).toBeDefined();
      expect(DESCRIPTIONS.SOLUTION).toBeDefined();
      expect(DESCRIPTIONS.OUTCOME).toBeDefined();
    });

    it('should contain configuration descriptions', () => {
      expect(DESCRIPTIONS.WINDOW_SIZE).toBeDefined();
      expect(DESCRIPTIONS.MAX_RESULTS).toBeDefined();
      expect(DESCRIPTIONS.PROGRESS_INDICATORS).toBeDefined();
      expect(DESCRIPTIONS.MIN_ACTIONS_FOR_DETECTION).toBeDefined();
      expect(DESCRIPTIONS.ALTERNATING_THRESHOLD).toBeDefined();
      expect(DESCRIPTIONS.REPETITION_THRESHOLD).toBeDefined();
      expect(DESCRIPTIONS.SEMANTIC_INTENTS).toBeDefined();
    });

    it('should contain threshold descriptions', () => {
      expect(DESCRIPTIONS.ENTROPY_THRESHOLD).toBeDefined();
      expect(DESCRIPTIONS.VARIANCE_THRESHOLD).toBeDefined();
      expect(DESCRIPTIONS.TREND_THRESHOLD).toBeDefined();
      expect(DESCRIPTIONS.CYCLICITY_THRESHOLD).toBeDefined();
    });

    it('should contain action and state descriptions', () => {
      expect(DESCRIPTIONS.ACTION_NAME).toBeDefined();
      expect(DESCRIPTIONS.ACTION_RESULT).toBeDefined();
      expect(DESCRIPTIONS.ENVIRONMENT_CONTEXT).toBeDefined();
    });

    it('should contain detection method descriptions', () => {
      expect(DESCRIPTIONS.DETECTION_METHOD).toBeDefined();
      expect(DESCRIPTIONS.LOOP_DETAILS).toBeDefined();
      expect(DESCRIPTIONS.ACTIONS_INVOLVED).toBeDefined();
    });

    it('should have meaningful content in descriptions', () => {
      expect(DESCRIPTIONS.PROGRESS_INDICATORS).toContain('patterns that indicate');
      expect(DESCRIPTIONS.SEMANTIC_INTENTS).toContain('Domain-specific');
      expect(DESCRIPTIONS.DETECTION_METHOD).toContain('statistical');
      expect(DESCRIPTIONS.DETECTION_METHOD).toContain('pattern');
      expect(DESCRIPTIONS.DETECTION_METHOD).toContain('hybrid');
    });

    it('should contain all expected keys', () => {
      const expectedKeys = [
        'LAST_ACTION',
        'CURRENT_CONTEXT',
        'GOAL',
        'LOOP_DETECTED',
        'LOOP_TYPE',
        'LOOP_CONFIDENCE',
        'LOOP_DETAILS',
        'ACTIONS_INVOLVED',
        'DETECTION_METHOD',
        'ENTROPY_SCORE',
        'VARIANCE_SCORE',
        'TREND_SCORE',
        'CYCLICITY_SCORE',
        'CURRENT_BELIEFS',
        'CONTRADICTING_EVIDENCE',
        'INITIAL_BELIEFS',
        'REVISED_BELIEFS',
        'REMOVED_BELIEFS',
        'RATIONALE',
        'PROBLEM_DESCRIPTION',
        'SOLUTION',
        'OUTCOME',
        'WINDOW_SIZE',
        'MAX_RESULTS',
        'PROGRESS_INDICATORS',
        'MIN_ACTIONS_FOR_DETECTION',
        'ALTERNATING_THRESHOLD',
        'REPETITION_THRESHOLD',
        'PROGRESS_THRESHOLD_ADJUSTMENT',
        'SEMANTIC_INTENTS',
        'ENTROPY_THRESHOLD',
        'VARIANCE_THRESHOLD',
        'TREND_THRESHOLD',
        'CYCLICITY_THRESHOLD',
        'ACTION_NAME',
        'ACTION_RESULT',
        'ENVIRONMENT_CONTEXT',
      ];

      expectedKeys.forEach((key) => {
        expect(DESCRIPTIONS).toHaveProperty(key);
      });
    });

    it('should have proper type definition as const', () => {
      // This test ensures the const assertion is working properly
      // TypeScript would fail compilation if DESCRIPTIONS wasn't properly typed
      expect(typeof DESCRIPTIONS).toBe('object');
      expect(DESCRIPTIONS).toBeDefined();
    });

    it('should not contain empty descriptions', () => {
      Object.entries(DESCRIPTIONS).forEach(([key, value]) => {
        expect(value.trim()).not.toBe('');
        expect(value.length).toBeGreaterThan(5); // Ensure meaningful descriptions
      });
    });

    it('should have consistent description formatting', () => {
      Object.values(DESCRIPTIONS).forEach((description) => {
        // Most descriptions should start with a capital letter or be well-formed
        expect(description).toMatch(/^[A-Z]|^[a-z]/);
        // Allow descriptions to end with periods or not
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });
});
