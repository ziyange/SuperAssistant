import { describe, expect, test } from 'vitest';
import { classifyQuestion } from '../src/question-router.js';

describe('Question Router', () => {
  test('routes a low-risk informational question without a Decision', () => {
    expect(classifyQuestion({ question: 'What changed in this task?', risk: 'LOW' })).toEqual({ level: 'L1', requiresDecision: false });
  });

  test('routes an authorization-impacting question through one Decision', () => {
    expect(classifyQuestion({ question: 'Grant network access?', risk: 'HIGH' })).toEqual({ level: 'L3', requiresDecision: true });
  });
});
