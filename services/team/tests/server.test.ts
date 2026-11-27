import { request } from 'node:http';
import { connect } from 'node:net';
import { Buffer } from 'node:buffer';
import { clearTimeout, setImmediate, setTimeout } from 'node:timers';
import { expect, test, vi } from 'vitest';
import { createAuthenticatedTeamServer, createTeamRequestHandler } from '../src/server.js';

test('keeps Team commands read-only before verified authority cutover', async () => {
  const handler = createTeamRequestHandler(() => 'LOCAL');
  await expect(handler({ method: 'POST', path: '/v1/commands' })).resolves.toEqual({
    status: 409,
    headers: { 'content-type': 'application/json' },
    body: '{"code":"TEAM_AUTHORITY_NOT_ACTIVE"}'
  });
});

test('serves health and a bounded SSE authority projection after cutover', async () => {
  const handler = createTeamRequestHandler(() => 'TEAM');
  await expect(handler({ method: 'GET', path: '/health' })).resolves.toEqual({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: '{"authority":"TEAM","writable":true}'
  });
  await expect(handler({ method: 'GET', path: '/v1/events' })).resolves.toEqual({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: 'event: authority\ndata: {"authority":"TEAM"}\n\n'
  });
});

test('rejects oversized declared and chunked Team bodies before repository writes', async () => {
  const createWorkspace = vi.fn(async () => {});
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate() { return { actor: 'actor', workspaceId: 'ws' }; } },
    undefined,
    { async authorize() { return { allowed: true }; } }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing listener address');
    const empty = JSON.stringify({ workspaceId: 'ws', name: '' });
    const body = JSON.stringify({ workspaceId: 'ws', name: 'x'.repeat(1048577 - Buffer.byteLength(empty)) });
    expect(Buffer.byteLength(body)).toBe(1048577);
    for (const chunked of [false, true]) {
      const status = await new Promise<number>((resolve, reject) => {
        const headers = chunked ? { 'transfer-encoding': 'chunked' } : { 'content-length': Buffer.byteLength(body) };
        const req = request({ hostname: '127.0.0.1', port: address.port, method: 'POST', path: '/v1/workspaces', headers },
          response => { response.resume(); response.once('end', () => resolve(response.statusCode ?? 0)); });
        req.once('error', reject);
        if (chunked) { req.write(body.slice(0, 700000)); req.end(body.slice(700000)); }
        else req.end(body);
      });
      expect(status).toBe(413);
      expect(createWorkspace).not.toHaveBeenCalled();
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('accepts exact byte limit but rejects malformed and unauthenticated writes', async () => {
  const createWorkspace = vi.fn(async () => {});
  const authorize = vi.fn(async () => ({ allowed: true as const }));
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate(req) { return req.headers['x-test-auth'] === 'yes' ? { actor: 'actor', workspaceId: 'ws' } : undefined; } },
    undefined,
    { authorize }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing listener address');
    const send = (body: string, authenticated: boolean, path = '/v1/workspaces') => new Promise<number>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: address.port, method: 'POST', path,
        headers: { 'content-length': Buffer.byteLength(body), 'x-test-auth': authenticated ? 'yes' : 'no' } },
      response => { response.resume(); response.once('end', () => resolve(response.statusCode ?? 0)); });
      req.once('error', reject);
      req.end(body);
    });
    expect(await send('not json', true)).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
    for (const body of ['[]', 'null', '"text"', '123']) {
      expect(await send(body, true, '/v1/workspaces/ws/unknown')).toBe(404);
    }
    expect(await send(JSON.stringify({ workspaceId: 'ws', name: 'ignored' }), false)).toBe(401);
    expect(authorize).not.toHaveBeenCalled();
    expect(createWorkspace).not.toHaveBeenCalled();
    const empty = JSON.stringify({ workspaceId: 'ws', name: '' });
    const exact = JSON.stringify({ workspaceId: 'ws', name: 'x'.repeat(1048576 - Buffer.byteLength(empty)) });
    expect(Buffer.byteLength(exact)).toBe(1048576);
    expect(await send(exact, true)).toBe(201);
    expect(createWorkspace).toHaveBeenCalledTimes(1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('an aborted Team body cannot invoke a repository write', async () => {
  const createWorkspace = vi.fn(async () => {});
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate() { return { actor: 'actor', workspaceId: 'ws' }; } },
    undefined,
    { async authorize() { return { allowed: true }; } }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing listener address');
    let signalReceived: () => void = () => {};
    const received = new Promise<void>(resolve => { signalReceived = resolve; });
    const closed = new Promise<void>(resolve => server.once('request', incoming => {
      incoming.once('close', resolve);
      signalReceived();
    }));
    const req = request({ hostname: '127.0.0.1', port: address.port, method: 'POST', path: '/v1/workspaces',
      headers: { 'content-length': 100 } });
    req.on('error', () => {});
    req.write('{"workspaceId":');
    await received;
    req.destroy();
    await closed;
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(createWorkspace).not.toHaveBeenCalled();
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('closes a rejected chunked sender that continues beyond the drain cap', async () => {
  const createWorkspace = vi.fn(async () => {});
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate() { return { actor: 'actor', workspaceId: 'ws' }; } },
    undefined,
    { async authorize() { return { allowed: true }; } }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listener address');
  const socket = connect(address.port, '127.0.0.1');
  socket.on('error', () => {});
  try {
    await new Promise<void>(resolve => socket.once('connect', resolve));
    const closed = new Promise<boolean>(resolve => socket.once('close', () => resolve(true)));
    const response = new Promise<string>(resolve => socket.once('data', data => resolve(data.toString('ascii'))));
    socket.write('POST /v1/workspaces HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n');
    socket.write('100001\r\n');
    socket.write(Buffer.alloc(1048577, 120));
    socket.write('\r\n');
    const noResponse = new Promise<string>(resolve => setTimeout(() => resolve('NO_RESPONSE'), 1500).unref());
    expect(await Promise.race([response, noResponse])).toContain(' 413 ');
    socket.write('300000\r\n');
    socket.write(Buffer.alloc(3145728, 120));
    const timeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2000).unref());
    expect(await Promise.race([closed, timeout])).toBe(true);
    expect(createWorkspace).not.toHaveBeenCalled();
  } finally {
    socket.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test.concurrent.each([1, 2, 3, 4, 5])('sends the complete rejection during concurrent oversized streaming #%i', async () => {
  const createWorkspace = vi.fn(async () => {});
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate() { return { actor: 'actor', workspaceId: 'ws' }; } },
    undefined,
    { async authorize() { return { allowed: true }; } }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listener address');
  const socket = connect(address.port, '127.0.0.1');
  socket.on('error', () => {});
  try {
    await new Promise<void>(resolve => socket.once('connect', resolve));
    const received = new Promise<string>(resolve => {
      let text = '';
      socket.on('data', data => {
        text += data.toString('ascii');
        if (text.includes('{"code":"TEAM_BODY_TOO_LARGE"}')) resolve(text);
      });
      socket.once('close', () => resolve(text));
      setTimeout(() => resolve(text), 2000).unref();
    });
    socket.write('POST /v1/workspaces HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5000000\r\n\r\n');
    socket.write(Buffer.alloc(4194304, 120));
    const response = await received;
    expect(response).toContain(' 413 ');
    expect(response).toContain('{"code":"TEAM_BODY_TOO_LARGE"}');
    expect(createWorkspace).not.toHaveBeenCalled();
  } finally {
    socket.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('one Team server rejects five simultaneous oversized clients without writes', async () => {
  const createWorkspace = vi.fn(async () => {});
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate() { return { actor: 'actor', workspaceId: 'ws' }; } },
    undefined,
    { async authorize() { return { allowed: true }; } }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listener address');
  const sockets: ReturnType<typeof connect>[] = [];
  const client = () => new Promise<string>(resolve => {
    const socket = connect(address.port, '127.0.0.1');
    sockets.push(socket);
    let response = '';
    const guard = setTimeout(() => { socket.destroy(); resolve(response); }, 2000);
    socket.on('error', () => {});
    socket.on('data', data => {
      response += data.toString('ascii');
      if (response.includes('{"code":"TEAM_BODY_TOO_LARGE"}')) {
        clearTimeout(guard);
        resolve(response);
      }
    });
    socket.once('close', () => { clearTimeout(guard); resolve(response); });
    socket.once('connect', () => {
      socket.write('POST /v1/workspaces HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5000000\r\n\r\n');
      socket.write(Buffer.alloc(4194304, 120));
    });
  });
  try {
    const results = await Promise.all([client(), client(), client(), client(), client()]);
    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result).toContain(' 413 ');
      expect(result).toContain('{"code":"TEAM_BODY_TOO_LARGE"}');
    }
    expect(createWorkspace).not.toHaveBeenCalled();
  } finally {
    sockets.forEach(socket => socket.destroy());
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('closes incomplete rejected requests no later than the ten-second deadline', async () => {
  const createWorkspace = vi.fn(async () => {});
  const server = createAuthenticatedTeamServer(
    { createWorkspace, async getWorkspace() { return undefined; }, async listEvents() { return []; } },
    { async authenticate(req) { return req.headers['x-test-auth'] === 'yes' ? { actor: 'actor', workspaceId: 'ws' } : undefined; } },
    undefined,
    { async authorize() { return { allowed: true }; } }
  );
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listener address');
  const sockets: ReturnType<typeof connect>[] = [];
  const exercise = (authenticated: boolean) => new Promise<{ response: string; elapsed: number }>((resolve, reject) => {
    const socket = connect(address.port, '127.0.0.1');
    sockets.push(socket);
    let response = '';
    let started = 0;
    const guard = setTimeout(() => { socket.destroy(); reject(new Error('Rejected request remained open')); }, 13000);
    socket.on('error', reject);
    socket.on('data', data => { response += data.toString('ascii'); });
    socket.once('connect', () => {
      started = Date.now();
      socket.write('POST /v1/workspaces HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5000000\r\nX-Test-Auth: ' + (authenticated ? 'yes' : 'no') + '\r\n\r\n');
    });
    socket.once('close', () => { clearTimeout(guard); resolve({ response, elapsed: Date.now() - started }); });
  });
  try {
    const [unauthenticated, oversized] = await Promise.all([exercise(false), exercise(true)]);
    expect(unauthenticated.response).toContain(' 401 ');
    expect(unauthenticated.response).toContain('{"code":"TEAM_SESSION_REQUIRED"}');
    expect(oversized.response).toContain(' 413 ');
    expect(oversized.response).toContain('{"code":"TEAM_BODY_TOO_LARGE"}');
    expect(unauthenticated.elapsed).toBeLessThan(13000);
    expect(oversized.elapsed).toBeLessThan(13000);
    expect(createWorkspace).not.toHaveBeenCalled();
  } finally {
    sockets.forEach(socket => socket.destroy());
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}, 15000);
