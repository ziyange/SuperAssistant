import type Database from 'better-sqlite3';

export class SqliteOnboardingRepository {
  // eslint-disable-next-line no-unused-vars -- TypeScript parameter property.
  constructor(private readonly database: Database.Database) {}

  async get(): Promise<{ completed: boolean }> {
    const row = this.database.prepare('SELECT completed FROM onboarding_state WHERE singleton = 1').get() as { completed: number } | undefined;
    if (row === undefined) return { completed: false };
    if (row.completed !== 0 && row.completed !== 1) throw new Error('Invalid stored onboarding state.');
    return { completed: row.completed === 1 };
  }

  async set(input: { completed: boolean }): Promise<{ completed: boolean }> {
    if (typeof input.completed !== 'boolean') throw new Error('Invalid onboarding state.');
    this.database.prepare('INSERT INTO onboarding_state (singleton, completed) VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET completed = excluded.completed').run(input.completed ? 1 : 0);
    return { completed: input.completed };
  }
}
