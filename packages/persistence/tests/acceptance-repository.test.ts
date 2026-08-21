import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteAcceptanceRepository } from '../src/repositories/acceptance-repository.js';
test('retains immutable evidence and rejects artifact reuse across Work Items', () => { const db = createFoundationDatabase(':memory:'); const repo = new SqliteAcceptanceRepository(db); const evidence = { evidenceId: 'e1', taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', artifactVersionId: 'artifact-1', evaluatorId: 'inspector-1', outcome: 'ACCEPTED' as const, createdAt: 'now' }; repo.append(evidence); expect(repo.listForTask('task-1')).toEqual([evidence]); expect(() => repo.append({ ...evidence, evidenceId: 'e2', workItemId: 'work-2' })).toThrow(/UNIQUE/); db.close(); });
