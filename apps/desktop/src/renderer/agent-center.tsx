export function AgentCenter({ connection, availability, version, functions, onCheck, checking, observedAt, notice }: Readonly<{ connection: string; availability: string; version: string; functions: readonly string[]; onCheck?: () => void; checking?: boolean; observedAt?: string | undefined; notice?: string | undefined }>) {
  const principal = connection === 'CONNECTED' ? availability : connection;
  return <section aria-label="Agent Center"><h2>Agent Center</h2><p>{principal}</p><p>Codex {version}</p><ul>{functions.map((fn) => <li key={fn}>{fn}</li>)}</ul>{observedAt && <p>Last check: {observedAt}</p>}{notice && <p role="status">{notice}</p>}{onCheck && <button type="button" disabled={checking} onClick={onCheck}>{checking ? 'Checking Codex...' : 'Check Codex'}</button>}</section>;
}
