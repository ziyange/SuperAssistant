import { Buffer } from 'node:buffer';
import Database from 'better-sqlite3';
import { expect, test } from 'vitest';
import { applyMigrations, foundationMigrations } from '../src/sqlite/migration-runner.js';

function fixture(before31 = false) {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyMigrations(db, before31 ? foundationMigrations.filter(migration => migration.version <= 30) : foundationMigrations);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Workspace','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO workspaces VALUES ('w2','other','Other','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO agents VALUES ('a','w','Agent','1','CONNECTED','AVAILABLE',NULL,1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','Project','E:/p','e:/p','ACTIVE','a',1,'2026','2026',1)").run();
  db.prepare("INSERT INTO projects VALUES ('p2','w2','Other','E:/p2','e:/p2','ACTIVE',NULL,1,'2026','2026',1)").run();
  db.prepare("INSERT INTO functions VALUES ('f','a','Function','1','ACTIVE')").run();
  return db;
}
function legacy(db: Database.Database, id = 'legacy', workspace = 'w', project = 'p') {
  db.prepare('INSERT INTO proposal_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, workspace, project, 'a', 'f', 'sensitive goal', '["FILE_WRITE"]', '1', '1', '1', '1', 'base', '2027', '2026', 'sha256:' + (id === 'legacy' ? 'a' : 'b').repeat(64));
}
function protectedPayload(db: Database.Database, id = 'protected', state = 'LINKED') {
  const key = 'pkey-' + 'a'.repeat(64);
  db.prepare('INSERT INTO protected_payloads VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, 'w', 'p', 'PROPOSAL', 1, key, Buffer.alloc(12), Buffer.from('cipher'), Buffer.alloc(16), '2026');
  db.prepare('INSERT INTO protected_key_reservations VALUES (?,?,?,?,?,?,?,?)').run(id, 'w', 'p', key, 'a'.repeat(64), state, '2026', '2026');
  return key;
}
function identity(db: Database.Database, id = 'protected', source = 'PROTECTED', workspace = 'w', project = 'p') {
  db.prepare('INSERT INTO proposal_authority_refs VALUES (?,?,?,?,?,?)').run(id, workspace, project, source, 1, '2026');
}
function binding(db: Database.Database, id = 'protected', record = id, workspace = 'w', project = 'p', key = 'pkey-' + 'a'.repeat(64)) {
  db.prepare('INSERT INTO protected_proposal_bindings VALUES (?,?,?,?,?,?,?,?,?)').run(id, 'PROTECTED', workspace, project, record, key, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1');
}

test('migration backfills legacy identity without changing its Proposal or digest', () => {
  const db = fixture(true);
  try {
    legacy(db);
    const before = db.prepare("SELECT * FROM proposal_versions WHERE proposal_version_id='legacy'").get();
    applyMigrations(db);
    expect(db.prepare("SELECT * FROM proposal_versions WHERE proposal_version_id='legacy'").get()).toEqual(before);
    expect(db.prepare("SELECT proposal_version_id,workspace_id,project_id,source_kind,binding_version FROM proposal_authority_refs").all()).toEqual([{ proposal_version_id: 'legacy', workspace_id: 'w', project_id: 'p', source_kind: 'LEGACY', binding_version: 1 }]);
    const registry = JSON.stringify(db.prepare('SELECT * FROM proposal_authority_refs').all());
    expect(registry).not.toContain('sensitive goal');
    expect(registry).not.toContain('sha256:');
    expect(db.pragma('foreign_key_check')).toEqual([]);
    applyMigrations(db);
    expect(db.prepare('SELECT count(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('future legacy inserts register atomically and conflicting protected identity rolls them back', () => {
  const db = fixture();
  try {
    legacy(db);
    expect(db.prepare("SELECT source_kind FROM proposal_authority_refs WHERE proposal_version_id='legacy'").get()).toEqual({ source_kind: 'LEGACY' });
    identity(db, 'conflict');
    expect(() => legacy(db, 'conflict')).toThrow();
    expect(db.prepare("SELECT count(*) AS n FROM proposal_versions WHERE proposal_version_id='conflict'").get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('binds only matching protected identity, ciphertext and linked reservation without granting authority', () => {
  const db = fixture();
  try {
    const key = protectedPayload(db);
    identity(db); binding(db, 'protected', 'protected', 'w', 'p', key);
    expect(db.prepare('SELECT proposal_version_id,source_kind,payload_record_id FROM protected_proposal_bindings').get()).toEqual({ proposal_version_id: 'protected', source_kind: 'PROTECTED', payload_record_id: 'protected' });
    expect(db.prepare('SELECT count(*) AS n FROM proposal_versions').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 0 });
    expect(db.prepare("PRAGMA table_info('protected_proposal_bindings')").all().map((row: unknown) => (row as { name: string }).name)).not.toContain('proposal_digest');
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(() => db.prepare("INSERT INTO authorization_grants VALUES ('g','protected','sha256:a','local-owner','key','[]','ISSUED','2026','2027')").run()).toThrow();
  } finally { db.close(); }
});

test.each(['wrong workspace', 'wrong project', 'wrong key', 'wrong record', 'unlinked', 'legacy source'])('rejects %s binding', kind => {
  const db = fixture();
  try {
    const key = protectedPayload(db, 'protected', kind === 'unlinked' ? 'RESERVED' : 'LINKED');
    if (kind === 'legacy source') legacy(db, 'protected');
    else identity(db);
    expect(() => binding(db, 'protected', kind === 'wrong record' ? 'other' : 'protected',
      kind === 'wrong workspace' ? 'w2' : 'w', kind === 'wrong project' ? 'p2' : 'p',
      kind === 'wrong key' ? 'pkey-' + 'b'.repeat(64) : key)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM protected_proposal_bindings').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('registry and protected binding reject replacement, mutation and deletion', () => {
  const db = fixture();
  try {
    const key = protectedPayload(db); identity(db); binding(db, 'protected', 'protected', 'w', 'p', key);
    expect(() => db.prepare("INSERT OR REPLACE INTO proposal_authority_refs VALUES ('protected','w','p','PROTECTED',1,'2026')").run()).toThrow();
    expect(() => db.prepare("UPDATE proposal_authority_refs SET source_kind='LEGACY' WHERE proposal_version_id='protected'").run()).toThrow();
    expect(() => db.prepare("DELETE FROM proposal_authority_refs WHERE proposal_version_id='protected'").run()).toThrow();
    expect(() => db.prepare("UPDATE protected_proposal_bindings SET key_ref='other' WHERE proposal_version_id='protected'").run()).toThrow();
    expect(() => db.prepare("DELETE FROM protected_proposal_bindings WHERE proposal_version_id='protected'").run()).toThrow();
    expect(() => db.prepare("INSERT OR REPLACE INTO protected_proposal_bindings VALUES ('protected','PROTECTED','w','p','protected',?,'PROPOSAL',1,'SAI_PROPOSAL_SHA256_V1')").run(key)).toThrow();
    expect(() => db.prepare("UPDATE protected_key_reservations SET state='UNCERTAIN' WHERE record_id='protected'").run()).toThrow();
    expect(db.prepare("SELECT state FROM protected_key_reservations WHERE record_id='protected'").get()).toEqual({ state: 'LINKED' });
  } finally { db.close(); }
});

test('null identifiers cannot bypass protected identity or composite foreign keys', () => {
  const db = fixture();
  try {
    const key = protectedPayload(db);
    expect(() => db.prepare("INSERT INTO proposal_authority_refs VALUES (NULL,'w','p','PROTECTED',1,'2026')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO protected_proposal_bindings VALUES (NULL,'PROTECTED','w','p','protected',?,'PROPOSAL',1,'SAI_PROPOSAL_SHA256_V1')").run(key)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM protected_proposal_bindings').get()).toEqual({ n: 0 });
    expect(db.pragma('foreign_key_check')).toEqual([]);
  } finally { db.close(); }
});

test('a Project with Proposal identities cannot move to another Workspace', () => {
  const db = fixture();
  try {
    identity(db);
    expect(() => db.prepare("UPDATE projects SET workspace_id='w2' WHERE project_id='p'").run()).toThrow();
    expect(db.prepare("SELECT workspace_id FROM projects WHERE project_id='p'").get()).toEqual({ workspace_id: 'w' });
  } finally { db.close(); }
});

test.each([0, 1])('Project replacement cannot bypass scope or canonical identity with recursive_triggers=%s', recursive => {
  const db = fixture();
  try {
    db.pragma(`recursive_triggers = ${recursive}`);
    identity(db);
    expect(() => db.prepare("INSERT OR REPLACE INTO projects VALUES ('p','w2','replacement','E:/other','e:/other','ACTIVE',NULL,1,'2026','2026',1)").run()).toThrow();
    expect(() => db.prepare("INSERT OR REPLACE INTO projects VALUES ('new-project','w','replacement','E:/p','e:/p','ACTIVE',NULL,1,'2026','2026',1)").run()).toThrow();
    expect(db.prepare("SELECT project_id,workspace_id,canonical_key FROM projects WHERE project_id='p'").get()).toEqual({ project_id: 'p', workspace_id: 'w', canonical_key: 'e:/p' });
    expect(db.prepare("SELECT source_kind,workspace_id,project_id FROM proposal_authority_refs WHERE proposal_version_id='protected'").get()).toEqual({ source_kind: 'PROTECTED', workspace_id: 'w', project_id: 'p' });
    expect(db.pragma('foreign_key_check')).toEqual([]);
  } finally { db.close(); }
});

test.each([0, 1])('legacy digest replacement cannot erase historical Proposal with recursive_triggers=%s', recursive => {
  const db = fixture();
  try {
    db.pragma(`recursive_triggers = ${recursive}`);
    legacy(db);
    const before = db.prepare("SELECT * FROM proposal_versions WHERE proposal_version_id='legacy'").get();
    expect(() => db.prepare('INSERT OR REPLACE INTO proposal_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'replacement', 'w', 'p', 'a', 'f', 'other goal', '["FILE_WRITE"]', '1', '1', '1', '1', 'base', '2027', '2026', 'sha256:' + 'a'.repeat(64)
    )).toThrow();
    expect(db.prepare("SELECT * FROM proposal_versions WHERE proposal_version_id='legacy'").get()).toEqual(before);
    expect(db.prepare('SELECT proposal_version_id FROM proposal_authority_refs').all()).toEqual([{ proposal_version_id: 'legacy' }]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
  } finally { db.close(); }
});

test('invalid legacy scope aborts migration without partially creating registry tables', () => {
  const db = fixture(true);
  try {
    legacy(db, 'legacy', 'w2', 'p');
    expect(() => applyMigrations(db)).toThrow();
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='proposal_authority_refs'").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT count(*) AS n FROM proposal_versions WHERE proposal_version_id='legacy'").get()).toEqual({ n: 1 });
  } finally { db.close(); }
});
