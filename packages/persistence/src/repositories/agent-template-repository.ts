/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createAgentTemplateVersion, type AgentTemplateVersion } from '@super-assistant/domain';

export class SqliteAgentTemplateRepository {
  constructor(private readonly database: Database.Database) {}
  append(input: AgentTemplateVersion): void { const version = createAgentTemplateVersion(input); this.database.prepare('INSERT INTO agent_template_versions VALUES (?, ?, ?, ?)').run(version.templateId, version.version, version.name, JSON.stringify(version.functionVersions)); }
  get(templateId: string, version: string): Readonly<AgentTemplateVersion> | null { const row = this.database.prepare('SELECT * FROM agent_template_versions WHERE template_id = ? AND version = ?').get(templateId, version) as Record<string, unknown> | undefined; return row ? createAgentTemplateVersion({ templateId: String(row.template_id), version: String(row.version), name: String(row.name), functionVersions: JSON.parse(String(row.function_versions_json)) }) : null; }
}
