import test from 'node:test';
import assert from 'node:assert/strict';

import { parseExpression, analyzeGrouping } from '../dist/index.js';

const analyze = (expr) => analyzeGrouping(parseExpression(expr));

const cases = [
  {
    name: 'NONE yields no mandatory requirements',
    expr: 'NONE',
    expected: { mandatory: [], groups: [] }
  },
  {
    name: 'single identifier becomes mandatory',
    expr: 'CS100',
    expected: { mandatory: ['CS100'], groups: [] }
  },
  {
    name: 'simple AND merges into mandatory list',
    expr: 'CS100 AND CS101',
    expected: { mandatory: ['CS100', 'CS101'], groups: [] }
  },
  {
    name: 'OR produces alternative groups',
    expr: 'CS100 OR CS101',
    expected: { mandatory: [], groups: [['CS100'], ['CS101']] }
  },
  {
    name: 'AND of OR keeps shared ids mandatory only once',
    expr: 'CS100 AND (CS101 OR CS102)',
    expected: { mandatory: ['CS100'], groups: [['CS101'], ['CS102']] }
  },
  {
    name: 'common factor across OR clauses stays mandatory',
    expr: '(CS100 AND CS101) OR (CS100 AND CS102)',
    expected: { mandatory: ['CS100'], groups: [['CS101'], ['CS102']] }
  },
  {
    name: 'duplicate disjuncts collapse into single group',
    expr: 'CS100 OR CS100',
    expected: { mandatory: ['CS100'], groups: [] }
  },
  {
    name: 'NONE within OR leaves no requirements',
    expr: 'NONE OR CS100',
    expected: { mandatory: [], groups: [] }
  },
  {
    name: 'symmetrical OR ordering stays deterministic',
    expr: 'CS103 OR CS101',
    expected: { mandatory: [], groups: [['CS101'], ['CS103']] }
  },
  {
    name: 'duplicate AND factors collapse into mandatory list',
    expr: 'CS100 AND CS100',
    expected: { mandatory: ['CS100'], groups: [] }
  }
];

cases.forEach(({ name, expr, expected }) => {
  test(name, () => {
    assert.deepEqual(analyze(expr), expected);
  });
});

test('multiple OR clauses with shared AND parts stay grouped by clause', () => {
  const result = analyze('(CS100 OR CS101) AND (CS200 OR CS201)');
  assert.deepEqual(result, {
    mandatory: [],
    groups: [
      ['CS100', 'CS200'],
      ['CS100', 'CS201'],
      ['CS101', 'CS200'],
      ['CS101', 'CS201']
    ]
  });
});

test('equivalent AND permutations deduplicate clauses', () => {
  const result = analyze('(CS101 AND CS102) OR (CS102 AND CS101)');
  assert.deepEqual(result, {
    mandatory: ['CS101', 'CS102'],
    groups: []
  });
});
