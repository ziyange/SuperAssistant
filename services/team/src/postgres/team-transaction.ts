/* eslint-disable no-unused-vars -- query port parameter names are public contract vocabulary. */
export interface TeamQuery { query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }> }

export async function withinTeamTransaction<T>(database: TeamQuery, action: () => Promise<T>): Promise<T> {
  await database.query('begin');
  try {
    const result = await action();
    await database.query('commit');
    return result;
  } catch (error) {
    await database.query('rollback');
    throw error;
  }
}
