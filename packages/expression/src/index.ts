import type { CourseId } from '@course-dag/core';

export type PrereqAst =
  | { type: 'NONE' }
  | { type: 'COURSE'; id: CourseId }
  | { type: 'AND'; left: PrereqAst; right: PrereqAst }
  | { type: 'OR'; left: PrereqAst; right: PrereqAst };

export interface GroupingAnalysis {
  mandatory: CourseId[];
  groups: CourseId[][];
}

export type CourseStatus = 'completed' | 'in_progress' | 'planned' | 'failed' | 'unknown';

export interface ParserErrorDetails {
  message: string;
  position: number; // 0-based index in the input string
}

export class PrereqParserError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'PrereqParserError';
    this.position = position;
  }
}

type TokenType = 'ID' | 'AND' | 'OR' | 'LPAREN' | 'RPAREN' | 'NONE' | 'EOF';
interface Token {
  type: TokenType;
  value?: string;
  start: number;
  end: number;
}

class Lexer {
  private i = 0;
  constructor(private readonly input: string) {}

  next(): Token {
    const s = this.input;
    const n = s.length;
    // skip whitespace
    while (this.i < n && /\s/.test(s[this.i]!)) this.i++;
    if (this.i >= n) return { type: 'EOF', start: this.i, end: this.i };
    const start = this.i;
    const ch = s[this.i]!;
    // parentheses
    if (ch === '(') {
      this.i++;
      return { type: 'LPAREN', start, end: this.i };
    }
    if (ch === ')') {
      this.i++;
      return { type: 'RPAREN', start, end: this.i };
    }
    // identifiers and keywords
    const idMatch = /^[A-Za-z0-9_\-]+/.exec(s.slice(this.i));
    if (idMatch) {
      const raw = idMatch[0]!;
      this.i += raw.length;
      const upper = raw.toUpperCase();
      if (upper === 'AND') return { type: 'AND', start, end: this.i };
      if (upper === 'OR') return { type: 'OR', start, end: this.i };
      if (upper === 'NONE') return { type: 'NONE', start, end: this.i };
      return { type: 'ID', value: raw, start, end: this.i };
    }
    // quotes around IDs are not supported for MVP to keep deterministic input
    throw new PrereqParserError(`Unexpected character '${ch}'`, this.i);
  }
}

// Pratt parser with precedence: AND > OR
class Parser {
  private current: Token;
  constructor(private readonly lexer: Lexer) {
    this.current = this.lexer.next();
  }

  private eat(type: TokenType): Token {
    if (this.current.type !== type) {
      throw new PrereqParserError(`Expected ${type} but found ${this.current.type}`,(this.current.start));
    }
    const tok = this.current;
    this.current = this.lexer.next();
    return tok;
  }

  parse(): PrereqAst {
    const expr = this.parseOr();
    if (this.current.type !== 'EOF') {
      throw new PrereqParserError(`Unexpected token ${this.current.type}`, this.current.start);
    }
    return expr;
  }

  private parseOr(): PrereqAst {
    let left = this.parseAnd();
    while (this.current.type === 'OR') {
      this.eat('OR');
      const right = this.parseAnd();
      left = { type: 'OR', left, right };
    }
    return left;
  }

  private parseAnd(): PrereqAst {
    let left = this.parsePrimary();
    while (this.current.type === 'AND') {
      this.eat('AND');
      const right = this.parsePrimary();
      left = { type: 'AND', left, right };
    }
    return left;
  }

  private parsePrimary(): PrereqAst {
    switch (this.current.type) {
      case 'NONE':
        this.eat('NONE');
        return { type: 'NONE' };
      case 'ID': {
        const id = this.eat('ID').value! as CourseId;
        return { type: 'COURSE', id };
      }
      case 'LPAREN': {
        this.eat('LPAREN');
        const inner = this.parseOr();
        this.eat('RPAREN');
        return inner;
      }
      default:
        throw new PrereqParserError(`Unexpected token ${this.current.type}`, this.current.start);
    }
  }
}

export function parseExpression(expression: string): PrereqAst {
  const input = (expression ?? '').trim();
  if (input.length === 0) return { type: 'NONE' };
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  return parser.parse();
}

export function stringifyAst(ast: PrereqAst): string {
  switch (ast.type) {
    case 'NONE':
      return 'NONE';
    case 'COURSE':
      return ast.id;
    case 'AND': {
      const left = stringifyAstParen(ast.left, 'AND');
      const right = stringifyAstParen(ast.right, 'AND');
      return `${left} AND ${right}`;
    }
    case 'OR': {
      const left = stringifyAstParen(ast.left, 'OR');
      const right = stringifyAstParen(ast.right, 'OR');
      return `${left} OR ${right}`;
    }
  }
}

function precedence(node: PrereqAst): number {
  switch (node.type) {
    case 'NONE':
    case 'COURSE':
      return 3;
    case 'AND':
      return 2;
    case 'OR':
      return 1;
  }
}

function stringifyAstParen(node: PrereqAst, context: 'AND' | 'OR'): string {
  const s = stringifyAst(node);
  const prec = precedence(node);
  const ctxPrec = context === 'AND' ? 2 : 1;
  return prec < ctxPrec ? `(${s})` : s;
}

export function evaluateAst(ast: PrereqAst, status: Map<CourseId, CourseStatus> | Set<CourseId>): boolean {
  const isCompleted = (id: CourseId) => {
    if (status instanceof Set) return status.has(id);
    const st = status.get(id);
    return st === 'completed';
  };
  switch (ast.type) {
    case 'NONE':
      return true;
    case 'COURSE':
      return isCompleted(ast.id);
    case 'AND':
      return evaluateAst(ast.left, status) && evaluateAst(ast.right, status);
    case 'OR':
      return evaluateAst(ast.left, status) || evaluateAst(ast.right, status);
  }
}

export function referencedCourseIds(ast: PrereqAst): Set<CourseId> {
  const ids = new Set<CourseId>();
  (function walk(n: PrereqAst) {
    switch (n.type) {
      case 'COURSE':
        ids.add(n.id);
        break;
      case 'AND':
      case 'OR':
        walk(n.left); walk(n.right);
        break;
      case 'NONE':
        break;
    }
  })(ast);
  return ids;
}

export function validateExpressionIds(ast: PrereqAst, knownIds: Set<CourseId>): { unknown: CourseId[] } {
  const refs = referencedCourseIds(ast);
  const unknown: CourseId[] = [];
  refs.forEach(id => { if (!knownIds.has(id)) unknown.push(id); });
  return { unknown };
}

export function analyzeGrouping(ast: PrereqAst): GroupingAnalysis {
  const clauses = uniqueClauses(collectClauses(ast));
  if (clauses.length === 0) {
    return { mandatory: [], groups: [] };
  }

  if (clauses.some((clause) => clause.length === 0)) {
    // If any clause requires no courses (e.g., NONE), overall expression is satisfiable without prerequisites.
    return { mandatory: [], groups: [] };
  }

  const mandatory = intersectClauses(clauses);
  const mandatorySet = new Set(mandatory);
  const groups = clauses
    .map((clause) => clause.filter((courseId) => !mandatorySet.has(courseId)))
    .filter((clause) => clause.length > 0)
    .map((clause) => clause.slice().sort(compareCourseId));

  groups.sort(compareClause);
  return { mandatory: mandatory.slice().sort(compareCourseId), groups };
}

function collectClauses(ast: PrereqAst): CourseId[][] {
  switch (ast.type) {
    case 'NONE':
      return [[]];
    case 'COURSE':
      return [[ast.id]];
    case 'AND': {
      const leftClauses = collectClauses(ast.left);
      const rightClauses = collectClauses(ast.right);
      const result: CourseId[][] = [];
      for (const left of leftClauses) {
        for (const right of rightClauses) {
          result.push(mergeClauses(left, right));
        }
      }
      return result;
    }
    case 'OR':
      return [...collectClauses(ast.left), ...collectClauses(ast.right)];
  }
}

function mergeClauses(left: CourseId[], right: CourseId[]): CourseId[] {
  const merged = new Set<CourseId>();
  left.forEach((id) => merged.add(id));
  right.forEach((id) => merged.add(id));
  return Array.from(merged).sort(compareCourseId);
}

function uniqueClauses(clauses: CourseId[][]): CourseId[][] {
  const seen = new Map<string, CourseId[]>();
  for (const clause of clauses) {
    const sorted = clause.slice().sort(compareCourseId);
    const key = sorted.join('||');
    if (!seen.has(key)) {
      seen.set(key, sorted);
    }
  }
  return Array.from(seen.values());
}

function intersectClauses(clauses: CourseId[][]): CourseId[] {
  if (clauses.length === 0) return [];
  let intersection = new Set<CourseId>(clauses[0]);
  for (let i = 1; i < clauses.length; i++) {
    const clauseSet = new Set<CourseId>(clauses[i]);
    intersection = new Set(Array.from(intersection).filter((id) => clauseSet.has(id)));
    if (intersection.size === 0) break;
  }
  return Array.from(intersection);
}

function compareClause(a: CourseId[], b: CourseId[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const cmp = compareCourseId(a[i]!, b[i]!);
    if (cmp !== 0) return cmp;
  }
  return a.length - b.length;
}

function compareCourseId(a: CourseId, b: CourseId): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
