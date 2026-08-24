export type DshJournalState = 'COVERED' | 'AMBIGUOUS';

/* eslint-disable no-unused-vars -- interface parameter names are event-journal contract vocabulary. */
export interface DshJournalEntry {
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, /token|secret|password|authorization|credential/i.test(key) ? '[REDACTED]' : redact(child)]));
}

export class DshEventJournal {
  private readonly entries = new Map<number, DshJournalEntry>();
  private nextSequence = 1;
  private state: DshJournalState = 'COVERED';

  constructor(readonly attemptId: string) {}

  append(entry: DshJournalEntry): { state: DshJournalState; deduplicated: boolean; entry: DshJournalEntry } {
    const safeEntry = { ...entry, payload: redact(entry.payload) as Record<string, unknown> };
    if (this.entries.has(entry.sequence)) return { state: this.state, deduplicated: true, entry: this.entries.get(entry.sequence)! };
    if (entry.sequence !== this.nextSequence) this.state = 'AMBIGUOUS';
    this.entries.set(entry.sequence, safeEntry);
    this.nextSequence = Math.max(this.nextSequence, entry.sequence + 1);
    return { state: this.state, deduplicated: false, entry: safeEntry };
  }
}
