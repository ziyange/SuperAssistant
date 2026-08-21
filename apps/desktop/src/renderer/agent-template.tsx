export function AgentTemplate({ template }: Readonly<{ template: Readonly<{ name: string; version: string; functions: readonly Readonly<{ name: string; version: string }>[] }> }>) {
  return <section aria-label="Agent Template"><h2>{template.name} v{template.version}</h2><ul>{template.functions.map((fn) => <li key={`${fn.name}:${fn.version}`}>{fn.name} v{fn.version}</li>)}</ul></section>;
}
