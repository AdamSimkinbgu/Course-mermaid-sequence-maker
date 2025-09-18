import test from 'node:test';
import assert from 'node:assert/strict';

import { validateGraph } from '../dist/index.js';

const baseGraph = {
  id: 'graph-1',
  nodes: [
    { id: 'CS100', nodeType: 'course', title: 'Intro' },
    { id: 'CS101', nodeType: 'course', title: 'Next' }
  ],
  edges: [
    { id: 'e1', source: 'CS100', target: 'CS101', groupingId: 'CS101::g1' }
  ],
  prereqExpressions: [
    { courseId: 'CS101', expression: 'CS100' }
  ]
};

test('validateGraph accepts a well-formed graph', () => {
  const result = validateGraph(baseGraph);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateGraph flags invalid grouping ids', () => {
  const graph = {
    ...baseGraph,
    edges: [{ id: 'e1', source: 'CS100', target: 'CS101', groupingId: 42 }]
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.match(result.errors[0] ?? '', /groupingId must be a string/);
});

test('validateGraph ensures edges reference existing nodes', () => {
  const graph = {
    ...baseGraph,
    edges: [{ id: 'e1', source: 'CS999', target: 'CS101' }]
  };
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.match(result.errors[0] ?? '', /source must reference an existing node id/);
});

