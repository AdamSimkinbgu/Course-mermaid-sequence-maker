import type { Edge, Node } from 'reactflow';

import type { LayoutDirection } from '../utils/layout';
import type { CourseNodeData } from './types';

export interface MermaidParseError {
  line: number;
  message: string;
}

interface ParsedNode {
  id: string;
  label?: string;
}

interface ParsedEdge {
  source: string;
  target: string;
}

export interface MermaidGraphSnapshot {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  direction: LayoutDirection;
}

export type MermaidParseResult =
  | { ok: true; graph: MermaidGraphSnapshot }
  | { ok: false; errors: MermaidParseError[] };

export interface MermaidApplyResultSuccess {
  ok: true;
}

export interface MermaidApplyResultFailure {
  ok: false;
  errors: MermaidParseError[];
}

export type MermaidApplyResult = MermaidApplyResultSuccess | MermaidApplyResultFailure;

export function generateMermaidFromGraph(
  nodes: Node<CourseNodeData>[],
  edges: Edge[],
  direction: LayoutDirection,
): string {
  const orientation = direction === 'TD' ? 'TB' : 'LR';
  const lines: string[] = [`flowchart ${orientation}`];

  if (nodes.length > 0) {
    lines.push('');
    nodes
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((node) => {
        const label = (node.data.label ?? node.id).replace(/\n/g, '<br/>');
        lines.push(`  ${node.id}["${escapeMermaidText(label)}"]`);
      });
  }

  if (edges.length > 0) {
    lines.push('');
    edges
      .slice()
      .sort((a, b) => {
        if (a.source === b.source) return a.target.localeCompare(b.target);
        return a.source.localeCompare(b.source);
      })
      .forEach((edge) => {
        lines.push(`  ${edge.source} --> ${edge.target}`);
      });
  }

  return lines.join('\n');
}

export function parseMermaid(code: string): MermaidParseResult {
  const lines = code
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: index + 1, text: raw.trim() }));

  const errors: MermaidParseError[] = [];
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let orientation: LayoutDirection = 'LR';
  let sawFlowchart = false;

  for (const { raw, text, line } of lines) {
    if (!text || text.startsWith('%%')) {
      continue;
    }

    if (!sawFlowchart) {
      const flowchartMatch = /^flowchart\s+(LR|RL|TB|BT)$/i.exec(text);
      if (!flowchartMatch) {
        errors.push({ line, message: 'First statement must declare flowchart orientation (e.g., "flowchart LR")' });
        break;
      }
      sawFlowchart = true;
      orientation = mermaidOrientationToLayout(flowchartMatch[1]!.toUpperCase());
      continue;
    }

    const nodeMatch = /^([A-Za-z0-9_:-]+)\s*\[(?:"([^"]*)"|([^\]]*))\]$/.exec(text);
    if (nodeMatch) {
      const id = nodeMatch[1]!;
      const quotedLabel = nodeMatch[2];
      const unquotedLabel = nodeMatch[3];
      const labelSource = quotedLabel !== undefined ? quotedLabel : unquotedLabel ?? '';
      const label = labelSource.replace(/<br\s*\/>/gi, '\n');
      nodes.set(id, { id, label });
      continue;
    }

    const edgeMatch = /^([A-Za-z0-9_:-]+)\s*--?>\s*([A-Za-z0-9_:-]+)$/.exec(text);
    if (edgeMatch) {
      const source = edgeMatch[1]!;
      const target = edgeMatch[2]!;
      edges.push({ source, target });
      if (!nodes.has(source)) nodes.set(source, { id: source });
      if (!nodes.has(target)) nodes.set(target, { id: target });
      continue;
    }

    errors.push({ line, message: `Unrecognised Mermaid statement: "${raw.trim()}"` });
  }

  if (!sawFlowchart) {
    errors.push({ line: 1, message: 'Missing "flowchart" declaration' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    graph: {
      nodes: Array.from(nodes.values()),
      edges,
      direction: orientation,
    },
  };
}

function escapeMermaidText(value: string): string {
  return value.replace(/"/g, '\\"');
}

function mermaidOrientationToLayout(value: string): LayoutDirection {
  switch (value) {
    case 'TB':
    case 'BT':
      return 'TD';
    case 'LR':
    case 'RL':
    default:
      return 'LR';
  }
}
