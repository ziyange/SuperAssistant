/* global URL */
import { closeSync, fstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export interface Migration { version: number; name: string; sql: string; mode?: 'controlled-rebuild'; }
export interface MigrationBackup { backupPath: string; dataVersion: number; fileDigest: string; }
const foundationSql = readFileSync(fileURLToPath(new URL('./migrations/001-foundation.sql', import.meta.url)), 'utf8');
const projectMetadataSql = readFileSync(fileURLToPath(new URL('./migrations/002-project-metadata.sql', import.meta.url)), 'utf8');
const proposalAuthorizationSql = readFileSync(fileURLToPath(new URL('./migrations/003-proposal-authorization.sql', import.meta.url)), 'utf8');
const executionSql = readFileSync(fileURLToPath(new URL('./migrations/004-execution.sql', import.meta.url)), 'utf8');
const artifactSql = readFileSync(fileURLToPath(new URL('./migrations/005-artifact.sql', import.meta.url)), 'utf8');
const decisionSql = readFileSync(fileURLToPath(new URL('./migrations/006-decision.sql', import.meta.url)), 'utf8');
const historyChangeSql = readFileSync(fileURLToPath(new URL('./migrations/007-history-change.sql', import.meta.url)), 'utf8');
const acceptanceSql = readFileSync(fileURLToPath(new URL('./migrations/008-acceptance.sql', import.meta.url)), 'utf8');
const recoveryAuditSql = readFileSync(fileURLToPath(new URL('./migrations/009-recovery-audit.sql', import.meta.url)), 'utf8');
const agentTemplateSql = readFileSync(fileURLToPath(new URL('./migrations/010-agent-template.sql', import.meta.url)), 'utf8');
const workItemGraphSql = readFileSync(fileURLToPath(new URL('./migrations/011-work-item-graph.sql', import.meta.url)), 'utf8');
const resourceSchedulerSql = readFileSync(fileURLToPath(new URL('./migrations/012-resource-scheduler.sql', import.meta.url)), 'utf8');
const qualityEvidenceSql = readFileSync(fileURLToPath(new URL('./migrations/013-quality-evidence.sql', import.meta.url)), 'utf8');
const monitoringEventsSql = readFileSync(fileURLToPath(new URL('./migrations/014-monitoring-events.sql', import.meta.url)), 'utf8');
const eventAggregationSql = readFileSync(fileURLToPath(new URL('./migrations/015-event-aggregation.sql', import.meta.url)), 'utf8');
const followUpBudgetSql = readFileSync(fileURLToPath(new URL('./migrations/016-follow-up-budget.sql', import.meta.url)), 'utf8');
const dshAttemptJournalSql = readFileSync(fileURLToPath(new URL('./migrations/017-dsh-attempt-journal.sql', import.meta.url)), 'utf8');
const onboardingSql = readFileSync(fileURLToPath(new URL('./migrations/018-onboarding.sql', import.meta.url)), 'utf8');
const outboxClaimsSql = readFileSync(fileURLToPath(new URL('./migrations/019-outbox-claims.sql', import.meta.url)), 'utf8');
const leaseExpirySql = readFileSync(fileURLToPath(new URL('./migrations/020-resource-lease-expiry.sql', import.meta.url)), 'utf8');
const codexRegistrationSql = readFileSync(fileURLToPath(new URL('./migrations/021-local-codex-registration.sql', import.meta.url)), 'utf8');
const grantUniquenessSql = readFileSync(fileURLToPath(new URL('./migrations/022-grant-uniqueness.sql', import.meta.url)), 'utf8');
const proposalDraftsSql = readFileSync(fileURLToPath(new URL('./migrations/023-proposal-drafts.sql', import.meta.url)), 'utf8');
const receiptPrincipalSql = readFileSync(fileURLToPath(new URL('./migrations/026-receipt-principal.sql', import.meta.url)), 'utf8');
const draftAgentGenerationSql = readFileSync(fileURLToPath(new URL('./migrations/028-draft-agent-generation.sql', import.meta.url)), 'utf8');
const protectedPayloadSql = readFileSync(fileURLToPath(new URL('./migrations/029-protected-payloads.sql', import.meta.url)), 'utf8');
const protectedKeyReservationsSql = readFileSync(fileURLToPath(new URL('./migrations/030-protected-key-reservations.sql', import.meta.url)), 'utf8');
const proposalAuthorityRegistrySql = readFileSync(fileURLToPath(new URL('./migrations/031-proposal-authority-registry.sql', import.meta.url)), 'utf8');
const proposalGrantForeignKeysSql = readFileSync(fileURLToPath(new URL('./migrations/032-proposal-grant-foreign-keys.sql', import.meta.url)), 'utf8');
const receiptClaimSql = readFileSync(fileURLToPath(new URL('./migrations/027-receipt-claim.sql', import.meta.url)), 'utf8');
const codexReceiptsSql = readFileSync(fileURLToPath(new URL('./migrations/025-codex-start-receipts.sql', import.meta.url)), 'utf8');
const proposalFullReviewSql = readFileSync(fileURLToPath(new URL('./migrations/024-full-proposal-review.sql', import.meta.url)), 'utf8');
export const foundationMigrations: readonly Migration[] = [{ version: 1, name: 'foundation', sql: foundationSql }, { version: 2, name: 'project-metadata', sql: projectMetadataSql }, { version: 3, name: 'proposal-authorization', sql: proposalAuthorizationSql }, { version: 4, name: 'execution', sql: executionSql }, { version: 5, name: 'artifact', sql: artifactSql }, { version: 6, name: 'decision', sql: decisionSql }, { version: 7, name: 'history-change', sql: historyChangeSql }, { version: 8, name: 'acceptance', sql: acceptanceSql }, { version: 9, name: 'recovery-audit', sql: recoveryAuditSql }, { version: 10, name: 'agent-template', sql: agentTemplateSql }, { version: 11, name: 'work-item-graph', sql: workItemGraphSql }, { version: 12, name: 'resource-scheduler', sql: resourceSchedulerSql }, { version: 13, name: 'quality-evidence', sql: qualityEvidenceSql }, { version: 14, name: 'monitoring-events', sql: monitoringEventsSql }, { version: 15, name: 'event-aggregation', sql: eventAggregationSql }, { version: 16, name: 'follow-up-budget', sql: followUpBudgetSql }, { version: 17, name: 'dsh-attempt-journal', sql: dshAttemptJournalSql }, { version: 18, name: 'onboarding', sql: onboardingSql }, { version: 19, name: 'outbox-claims', sql: outboxClaimsSql }, { version: 20, name: 'resource-lease-expiry', sql: leaseExpirySql }, { version: 21, name: 'local-codex-registration', sql: codexRegistrationSql }, { version: 22, name: 'grant-uniqueness', sql: grantUniquenessSql }, { version: 23, name: 'proposal-drafts', sql: proposalDraftsSql }, { version: 24, name: 'full-proposal-review', sql: proposalFullReviewSql }, { version: 25, name: 'codex-start-receipts', sql: codexReceiptsSql }, { version: 26, name: 'receipt-principal', sql: receiptPrincipalSql }, { version: 27, name: 'receipt-claim', sql: receiptClaimSql }, { version: 28, name: 'draft-agent-generation', sql: draftAgentGenerationSql }, { version: 29, name: 'protected-payloads', sql: protectedPayloadSql }, { version: 30, name: 'protected-key-reservations', sql: protectedKeyReservationsSql }, { version: 31, name: 'proposal-authority-registry', sql: proposalAuthorityRegistrySql }, { version: 32, name: 'proposal-grant-foreign-keys', sql: proposalGrantForeignKeysSql, mode: 'controlled-rebuild' }];

const historySql = 'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)';
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';

/** Hash a backup without printing its content or loading the complete file. */
export function hashMigrationBackup(path: string): string {
  const descriptor = openSync(path, 'r');
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.size <= 0n || before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MIGRATION_BACKUP_INVALID');
    const size = Number(before.size);
    const hash = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024);
    let offset = 0;
    while (offset < size) {
      const count = readSync(descriptor, buffer, 0, Math.min(buffer.length, size - offset), offset);
      if (count <= 0) throw new Error('MIGRATION_BACKUP_INVALID');
      hash.update(buffer.subarray(0, count)); offset += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error('MIGRATION_BACKUP_CHANGED');
    return hash.digest('hex');
  } finally { closeSync(descriptor); }
}

function fingerprint(database: Database.Database, excludeHistory: boolean, excludeRebuiltSchema: boolean): string {
  const hash = createHash('sha256');
  const add = (value: unknown) => { const text = JSON.stringify(value); hash.update(String(Buffer.byteLength(text, 'utf8')) + ':' + text); };
  add(['user_version', 'application_id', 'encoding', 'auto_vacuum', 'page_size'].map(name => database.pragma(name, { simple: true })));
  const schema = database.prepare(`SELECT type,name,tbl_name,sql FROM sqlite_master
    WHERE sql IS NOT NULL AND (substr(name,1,7)<>'sqlite_' OR name='sqlite_sequence')
      AND (?=0 OR name<>'schema_migrations') AND (?=0 OR tbl_name NOT IN ('authorization_grants','tasks'))
    ORDER BY type,name`).all(excludeHistory ? 1 : 0, excludeRebuiltSchema ? 1 : 0);
  add(schema);
  const tables = database.prepare(`SELECT name,sql FROM sqlite_master WHERE type='table'
    AND (substr(name,1,7)<>'sqlite_' OR name='sqlite_sequence') AND (?=0 OR name<>'schema_migrations') ORDER BY name`).all(excludeHistory ? 1 : 0) as { name: string; sql: string }[];
  for (const table of tables) {
    if (/^CREATE\s+VIRTUAL\s+TABLE/i.test(table.sql)) throw new Error('MIGRATION_UNSUPPORTED_SCHEMA');
    const columns = database.prepare('SELECT name FROM pragma_table_info(?) ORDER BY cid').all(table.name) as { name: string }[];
    if (columns.length === 0) throw new Error('MIGRATION_UNSUPPORTED_SCHEMA');
    add(table.name);
    const details = database.prepare("SELECT wr FROM pragma_table_list WHERE schema='main' AND name=?").get(table.name) as { wr: number } | undefined;
    if (!details || (details.wr !== 0 && details.wr !== 1)) throw new Error('MIGRATION_UNSUPPORTED_SCHEMA');
    const names = columns.map(column => column.name);
    if (details.wr === 0) {
      const lowered = new Set(names.map(name => name.toLowerCase()));
      const rowid = ['rowid', '_rowid_', 'oid'].find(name => !lowered.has(name));
      if (!rowid) throw new Error('MIGRATION_UNSUPPORTED_SCHEMA');
      names.unshift(rowid);
    }
    const expressions = names.map((name, index) => {
      const column = quote(name);
      return `(typeof(${column}) || ':' || CASE typeof(${column}) WHEN 'blob' THEN hex(${column}) WHEN 'text' THEN hex(CAST(${column} AS BLOB)) WHEN 'integer' THEN printf('%lld',${column}) WHEN 'real' THEN printf('%!.17g',${column}) ELSE '' END) AS c${index}`;
    });
    const order = names.map((_, index) => `c${index}`).join(',');
    for (const row of database.prepare(`SELECT ${expressions.join(',')} FROM ${quote(table.name)} ORDER BY ${order}`).iterate()) add(row);
  }
  return hash.digest('hex');
}

function validateRebuildSchema(database: Database.Database): void {
  const reference = new Database(':memory:');
  try {
    reference.exec(proposalAuthorizationSql); reference.exec(executionSql); reference.exec(grantUniquenessSql);
    const query = `SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN ('authorization_grants','tasks') AND sql IS NOT NULL ORDER BY type,name`;
    if (JSON.stringify(database.prepare(query).all()) !== JSON.stringify(reference.prepare(query).all())
      || database.prepare("SELECT 1 FROM sqlite_temp_master WHERE tbl_name IN ('authorization_grants','tasks') LIMIT 1").get()) throw new Error('MIGRATION_UNSUPPORTED_SCHEMA');
  } finally { reference.close(); }
}

/** Compare full-width filesystem identifiers; Windows file IDs can exceed 2^53. */
export function sameMigrationFileIdentity(left: { dev: bigint; ino: bigint }, right: { dev: bigint; ino: bigint }): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function verifyBackup(database: Database.Database, path: string, expectedDigest: string, sourcePath: string): void {
  const source = statSync(sourcePath, { bigint: true }), backupStat = statSync(path, { bigint: true });
  if (realpathSync(sourcePath) === realpathSync(path) || sameMigrationFileIdentity(source, backupStat)
    || !/^[a-f0-9]{64}$/.test(expectedDigest) || hashMigrationBackup(path) !== expectedDigest) throw new Error('MIGRATION_BACKUP_INVALID');
  const backup = new Database(path, { readonly: true, fileMustExist: true });
  try {
    if (backup.pragma('integrity_check', { simple: true }) !== 'ok'
      || fingerprint(database, false, false) !== fingerprint(backup, false, false)) throw new Error('MIGRATION_BACKUP_MISMATCH');
  } finally { backup.close(); }
}

function pendingMigrations(database: Database.Database, migrations: readonly Migration[]): Migration[] {
  const versions = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1 || versions.has(migration.version)) throw new Error('MIGRATION_PLAN_INVALID');
    versions.add(migration.version);
    if ((migration.version === 32 && (migration.mode !== 'controlled-rebuild' || migration.name !== 'proposal-grant-foreign-keys' || migration.sql !== proposalGrantForeignKeysSql))
      || (migration.mode && migration.version !== 32)) throw new Error('MIGRATION_PLAN_INVALID');
  }
  if (versions.has(32) && Array.from({ length: 32 }, (_, index) => index + 1).some(version => !versions.has(version))) throw new Error('MIGRATION_PLAN_INVALID');
  if (versions.has(32) && migrations.some(migration => {
    if (migration.version > 32) return false;
    const canonical = foundationMigrations.find(item => item.version === migration.version);
    return !canonical || canonical.name !== migration.name || canonical.sql !== migration.sql || canonical.mode !== migration.mode;
  })) throw new Error('MIGRATION_PLAN_INVALID');
  const exists = database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  const rows = exists ? database.prepare('SELECT version,name FROM schema_migrations').all() as { version: number; name: string }[] : [];
  if ([...versions].some(version => version > 32) && !versions.has(32) && !rows.some(row => row.version === 32)) throw new Error('MIGRATION_PLAN_INVALID');
  for (const row of rows) {
    const expected = migrations.find(item => item.version === row.version);
    if (expected && expected.name !== row.name) throw new Error('MIGRATION_HISTORY_INVALID');
  }
  if (versions.has(32)) {
    const history = rows.filter(row => row.version <= 32).map(row => row.version).sort((a, b) => a - b);
    if (history.some((version, index) => version !== index + 1)
      || rows.some(row => !versions.has(row.version))) throw new Error('MIGRATION_HISTORY_INVALID');
  }
  const applied = new Set(rows.map(row => row.version));
  return migrations.filter(({ version }) => !applied.has(version)).sort((left, right) => left.version - right.version);
}

function applyPending(database: Database.Database, pending: readonly Migration[]): void {
  database.exec(historySql);
  for (const migration of pending) {
    const apply = database.transaction(() => {
      let before: string | undefined;
      if (migration.mode === 'controlled-rebuild') {
        validateRebuildSchema(database);
        before = fingerprint(database, true, true);
      }
      database.exec(migration.sql);
      if (before !== undefined && fingerprint(database, true, true) !== before) throw new Error('MIGRATION_DATA_CHANGED');
      database.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)').run(migration.version, migration.name, new Date().toISOString());
    });
    apply();
  }
}

function restoreSettings(database: Database.Database, foreignKeys: number, legacyAlter: number, committed: boolean): void {
  let invalid = false;
  try {
    database.pragma(`legacy_alter_table = ${legacyAlter}`);
    if (database.pragma('legacy_alter_table', { simple: true }) !== legacyAlter) invalid = true;
  } catch { invalid = true; }
  try {
    database.pragma(`foreign_keys = ${foreignKeys}`);
    if (database.pragma('foreign_keys', { simple: true }) !== foreignKeys) invalid = true;
  } catch { invalid = true; }
  if (invalid) throw new Error(committed ? 'MIGRATION_COMMITTED_CONFIGURATION_FAILED' : 'MIGRATION_FOREIGN_KEYS_INVALID');
}

function integrityOkay(database: Database.Database): boolean {
  const violations = database.pragma('foreign_key_check');
  return database.pragma('integrity_check', { simple: true }) === 'ok' && Array.isArray(violations) && violations.length === 0;
}

export function applyMigrations(database: Database.Database, migrations: readonly Migration[] = foundationMigrations, backup?: MigrationBackup): void {
  const pending = pendingMigrations(database, migrations);
  if (!pending.some(item => item.mode === 'controlled-rebuild')) { applyPending(database, pending); return; }
  if (database.inTransaction) throw new Error('MIGRATION_REBUILD_NESTED');
  const databases = database.pragma('database_list') as { name: string; file: string }[];
  const main = databases.find(item => item.name === 'main');
  if (!main || databases.some(item => item.name !== 'main' && item.name !== 'temp')) throw new Error('MIGRATION_UNSUPPORTED_SCHEMA');
  if (main.file && (!backup || !Number.isSafeInteger(backup.dataVersion))) throw new Error('MIGRATION_BACKUP_REQUIRED');
  const originalForeignKeys = database.pragma('foreign_keys', { simple: true });
  if (originalForeignKeys !== 0 && originalForeignKeys !== 1) throw new Error('MIGRATION_FOREIGN_KEYS_INVALID');
  const originalLegacyAlter = database.pragma('legacy_alter_table', { simple: true });
  if (originalLegacyAlter !== 0 && originalLegacyAlter !== 1) throw new Error('MIGRATION_FOREIGN_KEYS_INVALID');
  let committed = false;
  try {
    database.pragma('foreign_keys = OFF');
    if (database.pragma('foreign_keys', { simple: true }) !== 0) throw new Error('MIGRATION_FOREIGN_KEYS_INVALID');
    database.pragma('legacy_alter_table = ON');
    if (database.pragma('legacy_alter_table', { simple: true }) !== 1) throw new Error('MIGRATION_FOREIGN_KEYS_INVALID');
    database.exec('BEGIN EXCLUSIVE');
    if (backup && main.file) {
      if (database.pragma('data_version', { simple: true }) !== backup.dataVersion) throw new Error('MIGRATION_DATABASE_CHANGED');
      verifyBackup(database, backup.backupPath, backup.fileDigest, main.file);
    }
    if (!integrityOkay(database)) throw new Error('MIGRATION_INTEGRITY_FAILED');
    applyPending(database, pendingMigrations(database, migrations));
    if (!integrityOkay(database)) throw new Error('MIGRATION_INTEGRITY_FAILED');
    if (backup && main.file && hashMigrationBackup(backup.backupPath) !== backup.fileDigest) throw new Error('MIGRATION_BACKUP_CHANGED');
    database.exec('COMMIT');
    committed = true;
  } catch (error) {
    if (database.inTransaction) database.exec('ROLLBACK');
    throw error;
  } finally {
    restoreSettings(database, originalForeignKeys, originalLegacyAlter, committed);
  }
}
