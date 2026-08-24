/* eslint-disable no-unused-vars -- query port parameter names are public contract vocabulary. */
export interface TeamQuery { query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }> }
export interface TeamTransactionClient extends TeamQuery { release?(): void }
export interface TeamTransactionDatabase extends TeamQuery { connect?(): Promise<TeamTransactionClient> }

export async function withinTeamTransaction<T>(database: TeamTransactionDatabase, action: (transaction: TeamQuery) => Promise<T>): Promise<T> {
  const transaction: TeamTransactionClient = database.connect === undefined ? database : await database.connect();
  await transaction.query('begin');
  try {
    const result = await action(transaction);
    await transaction.query('commit');
    return result;
  } catch (error) {
    await transaction.query('rollback');
    throw error;
  } finally {
    transaction.release?.();
  }
}
