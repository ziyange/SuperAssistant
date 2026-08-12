import { randomUUID } from 'node:crypto';

export type FoundationId = string & { readonly __foundationId: unique symbol };

export function createFoundationId(): FoundationId {
  const uuid = randomUUID();
  return `${uuid.slice(0, 14)}7${uuid.slice(15, 19)}${['8', '9', 'a', 'b'][Number.parseInt(uuid[19] ?? '0', 16) % 4]}${uuid.slice(20)}` as FoundationId;
}
