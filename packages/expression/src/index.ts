import type { CourseId } from '@course-dag/core';

export type PrereqAst =
  | { type: 'NONE' }
  | { type: 'COURSE'; id: CourseId }
  | { type: 'AND'; left: PrereqAst; right: PrereqAst }
  | { type: 'OR'; left: PrereqAst; right: PrereqAst };

export function parseExpression(expression: string): PrereqAst {
  // Placeholder parser; implement real grammar later.
  const trimmed = expression.trim();
  if (!trimmed || trimmed.toUpperCase() === 'NONE') return { type: 'NONE' };
  return { type: 'COURSE', id: trimmed as CourseId };
}

export function evaluate(ast: PrereqAst, completed: Set<CourseId>): boolean {
  switch (ast.type) {
    case 'NONE':
      return true;
    case 'COURSE':
      return completed.has(ast.id);
    case 'AND':
      return evaluate(ast.left, completed) && evaluate(ast.right, completed);
    case 'OR':
      return evaluate(ast.left, completed) || evaluate(ast.right, completed);
  }
}
