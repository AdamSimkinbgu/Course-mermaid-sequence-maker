import type { Graph, GraphNode, GraphEdge, CourseId } from '@course-dag/core';
import { parseExpression, type PrereqAst, referencedCourseIds } from '@course-dag/expression';

export interface ParseResult {
  graph: Graph;
  diagnostics: string[];
}

export function parseRows(rows: Array<Record<string, string>>): ParseResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const diagnostics: string[] = [];

  const seen = new Set<CourseId>();
  const exprByCourse = new Map<CourseId, PrereqAst>();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]!;
    const id = String(row.course_id || '').trim();
    const title = String(row.course_name || '').trim();
    const creditsRaw = String(row.credits ?? '').trim();
    const credits = creditsRaw === '' ? 0 : Number(creditsRaw);
    if (!id) diagnostics.push(`Row ${idx + 1}: Missing course_id`);
    if (!title) diagnostics.push(`Row ${idx + 1}: Missing course_name for ${id || '(unknown id)'}`);
    if (creditsRaw !== '' && (Number.isNaN(credits) || credits < 0)) diagnostics.push(`Row ${idx + 1}: Invalid credits for ${id}`);
    if (!id || !title || (creditsRaw !== '' && (Number.isNaN(credits) || credits < 0))) continue;
    if (seen.has(id)) {
      diagnostics.push(`Duplicate course_id '${id}' at row ${idx + 1}; skipping duplicate`);
      continue;
    }
    seen.add(id);
    nodes.push({ id, nodeType: 'course', title, credits });

    const expr = String(row.prereq_expression || '').trim();
    try {
      const ast: PrereqAst = parseExpression(expr || 'NONE');
      exprByCourse.set(id, ast);
    } catch (e) {
      diagnostics.push(`Row ${idx + 1}: Invalid prereq_expression for ${id}: ${(e as Error).message}`);
    }
  }

  // compile expressions into edges (AND/OR produce incoming edges from referenced courses)
  let edgeCounter = 0;
  for (const [targetId, ast] of exprByCourse.entries()) {
    const refs = referencedCourseIds(ast);
    refs.forEach((sourceId) => {
      if (!seen.has(sourceId)) {
        diagnostics.push(`Course '${targetId}' references unknown prerequisite '${sourceId}'`);
        return;
      }
      const id = `e${++edgeCounter}`;
      edges.push({ id, source: sourceId, target: targetId });
    });
  }

  // cycle detection (simple DFS)
  const cycles = findCycles(new Set(seen), edges);
  for (const cyc of cycles) {
    diagnostics.push(`Cycle detected: ${cyc.join(' -> ')} -> ${cyc[0]}`);
  }

  const graph: Graph = {
    id: `graph-${Date.now()}`,
    nodes,
    edges,
    prereqExpressions: Array.from(exprByCourse, ([courseId, ast]) => ({ courseId, expression: exprFor(ast) }))
  };
  return { graph, diagnostics };
}

function exprFor(ast: PrereqAst): string {
  // Re-stringify to normalized form
  // Lightweight inline to avoid circular import; acceptable to depend on stringifyAst later
  switch (ast.type) {
    case 'NONE': return 'NONE';
    case 'COURSE': return ast.id;
    case 'AND': return `${exprFor(ast.left)} AND ${exprFor(ast.right)}`;
    case 'OR': return `${paren(ast.left)} OR ${paren(ast.right)}`;
  }
}

function paren(a: PrereqAst): string {
  if (a.type === 'AND') return `(${exprFor(a)})`;
  return exprFor(a);
}

function findCycles(nodes: Set<CourseId>, edges: GraphEdge[]): CourseId[][] {
  const adj = new Map<CourseId, CourseId[]>();
  nodes.forEach(id => adj.set(id, []));
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const visited = new Set<CourseId>();
  const stack = new Set<CourseId>();
  const parent = new Map<CourseId, CourseId | null>();
  const cycles: CourseId[][] = [];

  function dfs(v: CourseId) {
    visited.add(v);
    stack.add(v);
    const nbrs = adj.get(v) || [];
    for (const w of nbrs) {
      if (!visited.has(w)) {
        parent.set(w, v);
        dfs(w);
      } else if (stack.has(w)) {
        // found cycle; backtrack from v to w
        const cycle: CourseId[] = [w];
        let cur: CourseId | null | undefined = v;
        while (cur && cur !== w) {
          cycle.push(cur);
          cur = parent.get(cur);
        }
        cycle.reverse();
        cycles.push(cycle);
      }
    }
    stack.delete(v);
  }

  nodes.forEach(id => { if (!visited.has(id)) { parent.set(id, null); dfs(id); } });
  return cycles;
}
