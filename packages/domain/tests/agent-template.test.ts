import { expect, test } from 'vitest';
import { createAgentTemplateVersion } from '../src/agent-template.js';

test('creates an immutable template version with pinned function versions', () => {
  const version = createAgentTemplateVersion({ templateId: 'template-1', version: '1.0.0', name: 'Developer', functionVersions: [{ functionId: 'function-1', version: '2.1.0' }] });
  expect(version).toEqual({ templateId: 'template-1', version: '1.0.0', name: 'Developer', functionVersions: [{ functionId: 'function-1', version: '2.1.0' }] });
  expect(Object.isFrozen(version)).toBe(true);
});
