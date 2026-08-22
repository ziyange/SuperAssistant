import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreRoot = new URL(
  '../../../node_modules/@google/gemini-cli-core/dist/',
  import.meta.url,
);

describe('Gemini Core 0.55.1 SAI compatibility probe', () => {
  it('records the public lifecycle primitives and rejects the missing durable operations', async () => {
    const publicIndex = await readFile(new URL('src/index.d.ts', coreRoot), 'utf8');
    const session = await readFile(
      new URL('src/agent/agent-session.d.ts', coreRoot),
      'utf8',
    );

    expect(publicIndex).toContain("export * from './agent/agent-session.js'");
    expect(session).toContain('send(payload: AgentSend)');
    expect(session).toContain('abort(): Promise<void>');
    expect(session).toContain('stream(options?');
    expect(session).not.toContain('status(');
    expect(session).not.toContain('result(');
    expect(session).not.toContain('reconcile(');
  });
});
