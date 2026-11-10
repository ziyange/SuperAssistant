import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { expect, test } from 'vitest';
import * as persistence from '../src/index.js';

type OnboardingRepository = {
  get(): Promise<{ completed: boolean }>;
  // eslint-disable-next-line no-unused-vars -- type-only port parameter.
  set(input: { completed: boolean }): Promise<{ completed: boolean }>;
};
// eslint-disable-next-line no-unused-vars -- type-only constructor parameter.
type OnboardingConstructor = new (database: Database.Database) => OnboardingRepository;

test('onboarding completion is persisted across database restart and constrained to booleans', async () => {
  const Repository = (persistence as unknown as { SqliteOnboardingRepository?: OnboardingConstructor }).SqliteOnboardingRepository;
  expect(typeof Repository).toBe('function');
  if (!Repository) throw new Error('Onboarding repository missing');
  const folder = mkdtempSync(join(tmpdir(), 'sa-onboarding-'));
  const path = join(folder, 'platform.sqlite');
  try {
    let database = persistence.createFoundationDatabase(path);
    let repository = new Repository(database);
    expect(await repository.get()).toEqual({ completed: false });
    expect(await repository.set({ completed: true })).toEqual({ completed: true });
    database.close();
    database = persistence.createFoundationDatabase(path);
    repository = new Repository(database);
    expect(await repository.get()).toEqual({ completed: true });
    expect(await repository.set({ completed: false })).toEqual({ completed: false });
    expect(() => database.prepare('UPDATE onboarding_state SET completed = 2').run()).toThrow();
    database.close();
    database = persistence.createFoundationDatabase(path);
    expect(await new Repository(database).get()).toEqual({ completed: false });
    database.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
