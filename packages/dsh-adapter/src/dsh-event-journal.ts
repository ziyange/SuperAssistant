/* eslint-disable no-unused-vars -- attemptId is retained as the journal scope. */
import { Buffer } from 'node:buffer';
import { createHmac, randomBytes } from 'node:crypto';
import { types } from 'node:util';

export type DshJournalState = 'COVERED' | 'AMBIGUOUS';

export interface DshJournalEntry {
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
}

const MAX_BYTES = 1_048_576;
const MAX_NODES = 10_000;
const MAX_DEPTH = 32;
type Budget = { nodes: number; bytes: number };

function consume(budget: Budget, bytes: number): void {
  budget.bytes += bytes;
  if (budget.bytes > MAX_BYTES) throw new Error('Invalid evidence');
}

function consumeString(value: string, budget: Budget): void {
  let bytes = Buffer.byteLength(value, 'utf8') + 2;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 34 || code === 92) bytes += 1;
    else if (code < 32) bytes += [8, 9, 10, 12, 13].includes(code) ? 1 : 5;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index++;
      else bytes += 3;
    } else if (code >= 0xdc00 && code <= 0xdfff) bytes += 3;
    if (bytes > MAX_BYTES) throw new Error('Invalid evidence');
  }
  consume(budget, bytes);
}

/** Canonicalize only bounded JSON data; never invoke getters or toJSON hooks. */
function normalize(value: unknown, depth: number, active: Set<object>, budget: Budget): unknown {
  if (depth > MAX_DEPTH || ++budget.nodes > MAX_NODES) throw new Error('Invalid evidence');
  consume(budget, 8);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    consumeString(value, budget);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid evidence');
    return value;
  }
  if (typeof value !== 'object' || types.isProxy(value) || active.has(value)) throw new Error('Invalid evidence');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_NODES || Object.getOwnPropertySymbols(value).length ||
          Object.getOwnPropertyNames(value).length !== value.length + 1) throw new Error('Invalid evidence');
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('Invalid evidence');
        result.push(normalize(descriptor.value, depth + 1, active, budget));
      }
      return result;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('Invalid evidence');
    if (Object.getOwnPropertySymbols(value).length) throw new Error('Invalid evidence');
    const keys = Object.getOwnPropertyNames(value);
    if (keys.length > MAX_NODES) throw new Error('Invalid evidence');
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys.sort()) {
      consumeString(key, budget);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('Invalid evidence');
      result[key] = normalize(descriptor.value, depth + 1, active, budget);
    }
    return result;
  } finally { active.delete(value); }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, /token|secret|password|authorization|credential|api[_ -]?key|private[_ -]?key|cookie/i.test(key) ? '[REDACTED]' : redact(child)]));
}

function detach(entry: DshJournalEntry): DshJournalEntry {
  return JSON.parse(JSON.stringify(entry)) as DshJournalEntry;
}

export class DshEventJournal {
  private readonly entries = new Map<number, { entry: DshJournalEntry; fingerprint: string }>();
  private readonly key = randomBytes(32);
  private nextSequence = 1;
  private state: DshJournalState = 'COVERED';

  constructor(readonly attemptId: string) {}

  append(entry: DshJournalEntry): { state: DshJournalState; deduplicated: boolean; entry: DshJournalEntry } {
    try {
      const normalized = normalize(entry, 0, new Set(), { nodes: 0, bytes: 0 }) as DshJournalEntry;
      if (!normalized || Object.keys(normalized).sort().join(',') !== 'payload,sequence,type' ||
          !Number.isSafeInteger(normalized.sequence) || normalized.sequence <= 0 ||
          typeof normalized.type !== 'string' || normalized.type.length === 0 || Buffer.byteLength(normalized.type, 'utf8') > 256 ||
          !normalized.payload || typeof normalized.payload !== 'object' || Array.isArray(normalized.payload)) throw new Error('Invalid evidence');
      const encoded = JSON.stringify({ type: normalized.type, payload: normalized.payload });
      if (Buffer.byteLength(encoded, 'utf8') > MAX_BYTES) throw new Error('Invalid evidence');
      const fingerprint = createHmac('sha256', this.key).update(encoded).digest('hex');
      const existing = this.entries.get(normalized.sequence);
      if (existing) {
        const same = existing.fingerprint === fingerprint;
        if (!same) this.state = 'AMBIGUOUS';
        return { state: this.state, deduplicated: same, entry: detach(existing.entry) };
      }
      if (normalized.sequence !== this.nextSequence) this.state = 'AMBIGUOUS';
      const safeEntry: DshJournalEntry = { sequence: normalized.sequence, type: normalized.type, payload: redact(normalized.payload) as Record<string, unknown> };
      this.entries.set(normalized.sequence, { entry: safeEntry, fingerprint });
      this.nextSequence = Math.max(this.nextSequence, normalized.sequence + 1);
      return { state: this.state, deduplicated: false, entry: detach(safeEntry) };
    } catch {
      this.state = 'AMBIGUOUS';
      return { state: this.state, deduplicated: false, entry: { sequence: 0, type: 'INVALID', payload: {} } };
    }
  }
}
