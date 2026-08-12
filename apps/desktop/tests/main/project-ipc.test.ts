import { expect, test } from 'vitest';
import { projectRegistrationError } from '../../src/main/project-ipc.js';

test('maps project validation failures to a safe user message', () => {
  expect(projectRegistrationError(new Error('ENOENT secret-token --verbose'))).toBe('Project path could not be validated.');
});
