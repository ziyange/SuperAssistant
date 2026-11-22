import { expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFoundationDatabase } from '@super-assistant/persistence';
import { LocalCodexRegistration } from '../../src/main/local-codex-registration.js';
import { builtinCodexFunctionId, isBuiltinCodexFunction, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { SqliteFoundationRepository } from '@super-assistant/persistence';

test('registration provisions one fixed built-in Function without granting execution', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-function-'));
  const executable = join(root, 'fake.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'not a real executable');
    const registration = new LocalCodexRegistration(db);
    registration.save(executable, '0.121.0');
    const { agent_id: agent, workspace_id: workspace } = db.prepare('SELECT agent_id, workspace_id FROM local_codex_registrations').get() as { agent_id: string; workspace_id: string };
    const id = builtinCodexFunctionId(agent);
    expect(isBuiltinCodexFunction(db, workspace, agent, id, '1')).toBe(true);
    registration.save(executable, '0.121.0');
    expect(db.prepare('SELECT count(*) AS n FROM functions').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    db.prepare("UPDATE functions SET lifecycle = 'DISABLED' WHERE function_id = ?").run(id);
    registration.save(executable, '0.121.0');
    expect(isBuiltinCodexFunction(db, workspace, agent, id, '1')).toBe(false);
    expect(db.prepare('SELECT lifecycle FROM functions WHERE function_id = ?').get(id)).toEqual({ lifecycle: 'DISABLED' });
    registration.save(executable, '0.122.0');
    expect(isBuiltinCodexFunction(db, workspace, agent, id, '1')).toBe(false);
    db.prepare("UPDATE functions SET name = 'tampered' WHERE function_id = ?").run(id);
    expect(() => registration.save(executable, '0.121.0')).toThrow();
    expect(db.prepare('SELECT observed_version FROM local_codex_registrations').get()).toEqual({ observed_version: '0.122.0' });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('unsupported protocol version does not provision a reviewable Function', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-function-version-'));
  const executable = join(root, 'fake.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'not a real executable');
    new LocalCodexRegistration(db).save(executable, '0.122.0');
    expect(db.prepare('SELECT count(*) AS n FROM functions').get()).toEqual({ n: 0 });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('registration never silently re-enables a disabled Agent, including after reopen', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-function-disabled-'));
  const executable = join(root, 'fake.exe');
  const database = join(root, 'platform.sqlite');
  let db = createFoundationDatabase(database);
  try {
    writeFileSync(executable, 'not a real executable');
    new LocalCodexRegistration(db).save(executable, '0.121.0');
    db.prepare("UPDATE agents SET connection = 'DISABLED', availability = 'PAUSED'").run();
    db.close();
    db = createFoundationDatabase(database);
    for (const version of ['0.121.0', '0.122.0']) {
      expect(() => new LocalCodexRegistration(db).save(executable, version)).toThrow();
      expect(db.prepare('SELECT connection, agent_version FROM agents').get()).toEqual({ connection: 'DISABLED', agent_version: '0.121.0' });
      expect(db.prepare('SELECT observed_version FROM local_codex_registrations').get()).toEqual({ observed_version: '0.121.0' });
    }
  } finally { if (db.open) db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('foreign workspaces and colliding catalog rows fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-function-collision-'));
  const executable = join(root, 'fake.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'not a real executable');
    new LocalCodexRegistration(db).save(executable, '0.121.0');
    const { agent_id: agent, workspace_id: workspace } = db.prepare('SELECT agent_id, workspace_id FROM local_codex_registrations').get() as { agent_id: string; workspace_id: string };
    const foreign = new SqliteFoundationRepository(db).createWorkspace({ ownerId: 'other-owner', name: 'Foreign' });
    const id = builtinCodexFunctionId(agent);
    expect(isBuiltinCodexFunction(db, foreign.workspaceId, agent, id, '1')).toBe(false);
    expect(() => provisionBuiltinCodexFunction(db, foreign.workspaceId, agent, '0.121.0')).toThrow();
    db.prepare("UPDATE functions SET name = 'pretender' WHERE function_id = ?").run(id);
    expect(isBuiltinCodexFunction(db, workspace, agent, id, '1')).toBe(false);
    expect(() => new LocalCodexRegistration(db).save(executable, '0.121.0')).toThrow();
    expect(db.prepare('SELECT name FROM functions WHERE function_id = ?').get(id)).toEqual({ name: 'pretender' });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
