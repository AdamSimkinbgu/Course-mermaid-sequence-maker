import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseExpression,
  stringifyAst,
  evaluateAst,
  referencedCourseIds,
  PrereqParserError
} from '../dist/index.js';

const stringify = (expr) => stringifyAst(parseExpression(expr));

test('parser respects operator precedence and preserves identifiers', () => {
  const normalized = stringify('CS100 OR CS101 AND CS200');
  assert.equal(normalized, 'CS100 OR CS101 AND CS200');
});

test('parser normalizes parentheses and NONE value', () => {
  const ast = parseExpression(' ( NONE ) ');
  assert.deepEqual(ast, { type: 'NONE' });
});

test('stringify reintroduces parentheses when required', () => {
  const normalized = stringify('(CS100 OR CS101) AND CS200');
  assert.equal(normalized, '(CS100 OR CS101) AND CS200');
});

test('parser throws with accurate position on invalid token', () => {
  assert.throws(
    () => parseExpression('CS100 + CS101'),
    (error) => {
      assert.ok(error instanceof PrereqParserError);
      assert.equal(error.position, 6);
      assert.match(error.message, /Unexpected character/);
      return true;
    }
  );
});

test('parser throws on dangling operator', () => {
  assert.throws(
    () => parseExpression('CS100 AND'),
    (error) => {
      assert.ok(error instanceof PrereqParserError);
      assert.match(error.message, /Unexpected token/);
      return true;
    }
  );
});

test('evaluateAst works with Set semantics', () => {
  const ast = parseExpression('CS100 AND (CS101 OR CS102)');
  const completed = new Set(['CS100', 'CS102']);
  assert.equal(evaluateAst(ast, completed), true);
  completed.delete('CS102');
  assert.equal(evaluateAst(ast, completed), false);
});

test('evaluateAst works with Map status semantics', () => {
  const ast = parseExpression('CS200 OR CS201');
  const status = new Map([
    ['CS200', 'planned'],
    ['CS201', 'completed']
  ]);
  assert.equal(evaluateAst(ast, status), true);
  status.set('CS201', 'failed');
  assert.equal(evaluateAst(ast, status), false);
});

test('referencedCourseIds collects unique identifiers', () => {
  const ast = parseExpression('CS100 AND (CS101 OR CS100)');
  const ids = referencedCourseIds(ast);
  assert.deepEqual(new Set(ids), new Set(['CS100', 'CS101']));
});
