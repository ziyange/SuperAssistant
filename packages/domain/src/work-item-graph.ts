export interface WorkItemGraph { taskId: string; nodes: readonly string[]; edges: readonly Readonly<{ from: string; to: string }>[]; }

export function createWorkItemGraph(input: WorkItemGraph): Readonly<WorkItemGraph> {
  const adjacency = new Map(input.nodes.map((node) => [node, [] as string[]]));
  for (const edge of input.edges) { if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) throw new Error('WORK_ITEM_GRAPH_UNKNOWN_NODE'); adjacency.get(edge.from)!.push(edge.to); }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (node: string): void => { if (visiting.has(node)) throw new Error('WORK_ITEM_GRAPH_CYCLE'); if (visited.has(node)) return; visiting.add(node); adjacency.get(node)!.forEach(visit); visiting.delete(node); visited.add(node); };
  input.nodes.forEach(visit);
  return Object.freeze({ taskId: input.taskId, nodes: Object.freeze([...input.nodes]), edges: Object.freeze(input.edges.map((edge) => Object.freeze({ ...edge }))) });
}

export function readyWorkItems(graph: WorkItemGraph, accepted: readonly string[]): readonly string[] {
  const done = new Set(accepted); return graph.nodes.filter((node) => !done.has(node) && graph.edges.filter((edge) => edge.to === node).every((edge) => done.has(edge.from)));
}
