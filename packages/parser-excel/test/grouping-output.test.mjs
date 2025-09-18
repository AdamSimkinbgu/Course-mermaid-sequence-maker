import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRows } from '../dist/index.js';

const baseCourses = [
  { course_id: 'CS100', course_name: 'Intro Programming', credits: '3', prereq_expression: 'NONE' },
  { course_id: 'CS101', course_name: 'Data Structures', credits: '3', prereq_expression: 'CS100' },
  { course_id: 'CS103', course_name: 'Discrete Math', credits: '3', prereq_expression: 'NONE' },
  { course_id: 'MATH100', course_name: 'Calculus I', credits: '4', prereq_expression: 'NONE' }
];

function extractEdges(result, targetId) {
  return result.graph.edges
    .filter((edge) => edge.target === targetId)
    .map((edge) => ({ source: edge.source, groupingId: edge.groupingId ?? null }))
    .sort((a, b) => a.source.localeCompare(b.source) || ((a.groupingId ?? '')).localeCompare(b.groupingId ?? ''));
}

test('mandatory prerequisites emit edges without groupingId', () => {
  const rows = [
    ...baseCourses,
    { course_id: 'CS102', course_name: 'Algorithms', credits: '3', prereq_expression: 'CS100 AND (CS101 OR CS103)' }
  ];
  const result = parseRows(rows);
  assert.deepEqual(result.diagnostics, []);
  const edges = extractEdges(result, 'CS102');
  assert.deepEqual(edges, [
    { source: 'CS100', groupingId: null },
    { source: 'CS101', groupingId: 'CS102::g1' },
    { source: 'CS103', groupingId: 'CS102::g2' }
  ]);
});

test('OR clauses with AND components share grouping ids per clause', () => {
  const rows = [
    ...baseCourses,
    { course_id: 'CS200', course_name: 'Advanced Topics', credits: '3', prereq_expression: '(CS100 AND CS101) OR MATH100' }
  ];
  const result = parseRows(rows);
  assert.deepEqual(result.diagnostics, []);
  const edges = extractEdges(result, 'CS200');
  assert.deepEqual(edges, [
    { source: 'CS100', groupingId: 'CS200::g1' },
    { source: 'CS101', groupingId: 'CS200::g1' },
    { source: 'MATH100', groupingId: 'CS200::g2' }
  ]);
});

test('OR disjuncts are assigned deterministic grouping ids', () => {
  const rows = [
    ...baseCourses,
    { course_id: 'CS202', course_name: 'Combinatorics', credits: '3', prereq_expression: 'CS103 OR CS101' }
  ];
  const result = parseRows(rows);
  assert.deepEqual(result.diagnostics, []);
  const edges = extractEdges(result, 'CS202');
  assert.deepEqual(edges, [
    { source: 'CS101', groupingId: 'CS202::g1' },
    { source: 'CS103', groupingId: 'CS202::g2' }
  ]);
});

test('duplicate prerequisites collapse to a single mandatory edge', () => {
  const rows = [
    ...baseCourses,
    { course_id: 'CS201', course_name: 'Special Topics', credits: '3', prereq_expression: 'CS100 OR CS100' }
  ];
  const result = parseRows(rows);
  assert.deepEqual(result.diagnostics, []);
  const edges = extractEdges(result, 'CS201');
  assert.deepEqual(edges, [
    { source: 'CS100', groupingId: null }
  ]);
});

test('NONE shortcut generates no prerequisite edges', () => {
  const rows = [
    ...baseCourses,
    { course_id: 'CS203', course_name: 'Seminar', credits: '2', prereq_expression: 'NONE OR CS100' }
  ];
  const result = parseRows(rows);
  assert.deepEqual(result.diagnostics, []);
  const edges = extractEdges(result, 'CS203');
  assert.deepEqual(edges, []);
});
