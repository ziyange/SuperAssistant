import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteAgentTemplateRepository } from '../src/repositories/agent-template-repository.js';

test('persists immutable Template versions and rejects mutation', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteAgentTemplateRepository(database);
  repository.append({ templateId: 'template-1', version: '1.0.0', name: 'Developer', functionVersions: [{ functionId: 'function-1', version: '2.1.0' }] });
  expect(repository.get('template-1', '1.0.0')).toEqual({ templateId: 'template-1', version: '1.0.0', name: 'Developer', functionVersions: [{ functionId: 'function-1', version: '2.1.0' }] });
  expect(() => database.prepare("UPDATE agent_template_versions SET name = 'Changed'").run()).toThrow(/immutable/);
  database.close();
});
