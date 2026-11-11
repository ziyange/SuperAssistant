import { expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { SqliteFoundationRepository } from '../../../../packages/persistence/src/repositories/foundation-repository.js';

test('Codex registration keeps one stable non-live Agent and a path-free projection across restart', async () => {
  const module = await import('../../src/main/local-codex-registration.js').catch(() => ({}));
  const Constructor = Reflect.get(module, 'LocalCodexRegistration');
  expect(typeof Constructor).toBe('function');
  const root = mkdtempSync(join(tmpdir(), 'sa-codex-register-'));
  const executable = join(root, 'codex.exe');
  const databasePath = join(root, 'platform.sqlite');
  let db = createFoundationDatabase(databasePath);
  try {
    writeFileSync(executable, 'fake executable; never launched');
    const registry = new Constructor(db);
    expect(registry.get()).toEqual({ state: 'NOT_REGISTERED' });
    registry.save(executable, '0.121.0');
    const first = db.prepare('SELECT agent_id FROM local_codex_registrations').get() as { agent_id: string };
    registry.save(executable, '0.122.0');
    expect(db.prepare('SELECT agent_id FROM local_codex_registrations').get()).toEqual(first);
    expect(db.prepare('SELECT COUNT(*) AS count FROM agents').get()).toEqual({ count: 1 });
    expect(db.prepare('SELECT connection, availability, agent_version FROM agents').get()).toEqual({ connection: 'UNAVAILABLE', availability: 'PAUSED', agent_version: '0.122.0' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM functions').get()).toEqual({ count: 0 });
    db.close(); db = createFoundationDatabase(databasePath);
    const projection = new Constructor(db).get();
    expect(projection).toEqual({ state: 'RECHECK_REQUIRED', version: '0.122.0' });
    expect(JSON.stringify(projection)).not.toContain(root);
    expect(JSON.stringify(projection)).not.toContain('CONNECTED');
    new SqliteFoundationRepository(db).createWorkspace({ ownerId: 'local-owner', name: 'Ambiguous' });
    expect(() => new Constructor(db).save(executable, '0.123.0')).toThrow();
    expect(db.prepare('SELECT agent_version FROM agents').get()).toEqual({ agent_version: '0.122.0' });
  } finally { if (db.open) db.close(); rmSync(root, { recursive: true, force: true }); }
}, 30_000);

test('an unlinked legacy Codex Agent is never silently duplicated or repurposed', async () => {
  const module = await import('../../src/main/local-codex-registration.js');
  const root = mkdtempSync(join(tmpdir(), 'sa-codex-existing-'));
  const executable = join(root, 'codex.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'fake executable; never launched');
    const foundation = new SqliteFoundationRepository(db);
    const workspace = foundation.createWorkspace({ ownerId: 'local-owner', name: 'Local' });
    foundation.createAgent({ workspaceId: workspace.workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: '1.0.0' });
    expect(() => new module.LocalCodexRegistration(db).save(executable, '0.121.0')).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS count FROM agents').get()).toEqual({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM local_codex_registrations').get()).toEqual({ count: 0 });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('locked local Workspace blocks registration without creating a replacement', async () => {
  const module = await import('../../src/main/local-codex-registration.js');
  const root = mkdtempSync(join(tmpdir(), 'sa-codex-locked-'));
  const executable = join(root, 'codex.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'fake executable; never launched');
    const workspace = new SqliteFoundationRepository(db).createWorkspace({ ownerId: 'local-owner', name: 'Locked' });
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(workspace.workspaceId);
    const registry = new module.LocalCodexRegistration(db);
    expect(() => registry.save(executable, '0.121.0')).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS count FROM workspaces').get()).toEqual({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM agents').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM local_codex_registrations').get()).toEqual({ count: 0 });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
