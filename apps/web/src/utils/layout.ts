import dagre from '@dagrejs/dagre';
import type { Edge, Node } from 'reactflow';
import { Position } from 'reactflow';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

export type LayoutDirection = 'LR' | 'TD';

interface LayoutOptions {
  direction: LayoutDirection;
}

export function applyDagreLayout<T extends Node>(
  nodes: T[],
  edges: Edge[],
  options: LayoutOptions,
): T[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: options.direction === 'LR' ? 'LR' : 'TB', nodesep: 48, ranksep: 96 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) {
      return node;
    }

    const isHorizontal = options.direction === 'LR';

    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    } as T;
  });
}
