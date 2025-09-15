import type { Graph, GraphNode, GraphEdge } from '@course-dag/core';
import { parseExpression, type PrereqAst } from '@course-dag/expression';

export interface ParseResult {
  graph: Graph;
  diagnostics: string[];
}

export function parseRows(rows: Array<Record<string, string>>): ParseResult {
  // Minimal stub: produce nodes only; edges/expression handling will come later.
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const diagnostics: string[] = [];

  for (const row of rows) {
    const id = String(row.course_id || '').trim();
    const title = String(row.course_name || '').trim();
    const credits = Number(row.credits || '0');
    if (!id) diagnostics.push('Missing course_id');
    if (!title) diagnostics.push(`Missing course_name for ${id || '(unknown id)'}`);
    if (Number.isNaN(credits) || credits < 0) diagnostics.push(`Invalid credits for ${id}`);
    if (!id || !title || Number.isNaN(credits) || credits < 0) continue;
    nodes.push({ id, nodeType: 'course', title, credits });

    const expr = String(row.prereq_expression || '').trim();
    // parse to ensure grammar is at least syntactically acceptable
    try {
      const ast: PrereqAst = parseExpression(expr || 'NONE');
      void ast;
    } catch (e) {
      diagnostics.push(`Invalid prereq_expression for ${id}: ${(e as Error).message}`);
    }
  }

  const graph: Graph = { id: 'temp', nodes, edges };
  return { graph, diagnostics };
}
