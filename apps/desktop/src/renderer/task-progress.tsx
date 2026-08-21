/* eslint-disable no-control-regex -- intentionally strips renderer control characters. */
function safeProgressText(value: string): string {
  return value.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 4096);
}

export function TaskProgress({ activity }: Readonly<{ activity: readonly string[] }>) {
  return <section aria-label="Task progress" aria-live="polite"><h3>Progress</h3>{activity.length === 0 ? <p>No activity recorded.</p> : <ol>{activity.map((entry, index) => <li key={`${index}:${entry}`}>{safeProgressText(entry)}</li>)}</ol>}</section>;
}
