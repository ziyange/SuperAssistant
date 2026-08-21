import { expect, test } from 'vitest';
import { createWorkItemGraph, readyWorkItems } from '../src/work-item-graph.js';

test('rejects cycles and exposes only nodes with satisfied dependencies', () => {
  expect(() => createWorkItemGraph({ taskId: 'task-1', nodes: ['a', 'b'], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] })).toThrow('WORK_ITEM_GRAPH_CYCLE');
  const graph = createWorkItemGraph({ taskId: 'task-1', nodes: ['a', 'b'], edges: [{ from: 'a', to: 'b' }] });
  expect(readyWorkItems(graph, [])).toEqual(['a']);
  expect(readyWorkItems(graph, ['a'])).toEqual(['b']);
});
