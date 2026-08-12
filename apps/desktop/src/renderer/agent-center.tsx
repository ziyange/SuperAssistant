export function AgentCenter({ connection, availability, version, functions }: Readonly<{ connection: string; availability: string; version: string; functions: readonly string[] }>) {
  const principal = connection === 'CONNECTED' ? availability : connection;
  return <section aria-label="Agent Center"><h2>Agent Center</h2><p>{principal}</p><p>Codex {version}</p><ul>{functions.map((fn) => <li key={fn}>{fn}</li>)}</ul>{connection === 'AUTH_REQUIRED' && <button type="button">Repair authentication</button>}</section>;
}
