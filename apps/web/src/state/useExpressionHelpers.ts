import { useCallback, useRef } from 'react';

import {
  evaluateAst,
  parseExpression,
  referencedCourseIds,
  type PrereqAst,
} from '@course-dag/expression';

import type { CourseStatus } from './types';

export function useExpressionHelpers(expressions: Map<string, string>) {
  const astCacheRef = useRef<Map<string, PrereqAst>>(new Map());

  const getExpression = useCallback(
    (courseId: string) => expressions.get(courseId) ?? 'NONE',
    [expressions],
  );

  const getAst = useCallback(
    (courseId: string) => {
      const expression = getExpression(courseId);
      const cacheKey = `${courseId}::${expression}`;
      const cached = astCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const ast = parseExpression(expression);
      astCacheRef.current.set(cacheKey, ast);
      return ast;
    },
    [getExpression],
  );

  const getPrerequisiteSet = useCallback(
    (courseId: string) => {
      const expression = getExpression(courseId);
      if (!hasMeaningfulExpression(expression)) {
        return new Set<string>();
      }
      const ast = getAst(courseId);
      return new Set(referencedCourseIds(ast));
    },
    [getAst, getExpression],
  );

  const evaluateCourseEligibility = useCallback(
    (courseId: string, statusMap: Map<string, CourseStatus>) => {
      const expression = getExpression(courseId);
      if (!hasMeaningfulExpression(expression)) {
        return true;
      }
      const ast = getAst(courseId);
      return evaluateAst(ast, statusMap);
    },
    [getAst, getExpression],
  );

  const invalidateCourse = useCallback((courseId: string) => {
    const expression = getExpression(courseId);
    const cacheKey = `${courseId}::${expression}`;
    astCacheRef.current.delete(cacheKey);
  }, [getExpression]);

  return {
    getExpression,
    getAst,
    getPrerequisiteSet,
    evaluateCourseEligibility,
    invalidateCourse,
    astCacheRef,
  } as const;
}

export function hasMeaningfulExpression(expression: string): boolean {
  if (!expression) return false;
  return expression.trim().toUpperCase() !== 'NONE';
}
