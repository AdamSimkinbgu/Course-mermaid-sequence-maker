import { internalsSymbol } from 'reactflow';
import type { Edge, Node } from 'reactflow';

import type { CourseNodeData, GraphSnapshot } from './types';

export function captureGraphSnapshot(
  nodes: Node<CourseNodeData>[],
  edges: Edge[],
  expressions: Map<string, string>,
): GraphSnapshot {
  return {
    nodes: nodes.map((node) => cloneNodeForSnapshot(node)),
    edges: edges.map((edge) => cloneEdgeForSnapshot(edge)),
    expressions: Array.from(expressions.entries()),
  };
}

export function serializeGraphSnapshot(snapshot: GraphSnapshot): string {
  return JSON.stringify(snapshot);
}

export function cloneNodeFromSnapshot(node: Node<CourseNodeData>): Node<CourseNodeData> {
  const result: Node<CourseNodeData> = {
    ...node,
    position: { ...node.position },
    data: { ...node.data },
    positionAbsolute: node.positionAbsolute ? { ...node.positionAbsolute } : undefined,
    style: node.style ? { ...node.style } : undefined,
  };

  result.width = node.width ?? undefined;
  result.height = node.height ?? undefined;
  (result as any)[internalsSymbol] = undefined;

  return result;
}

export function cloneEdgeFromSnapshot(edge: Edge): Edge {
  return {
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    style: edge.style ? { ...edge.style } : undefined,
    markerStart: cloneMarker(edge.markerStart),
    markerEnd: cloneMarker(edge.markerEnd),
  };
}

function cloneNodeForSnapshot(node: Node<CourseNodeData>): Node<CourseNodeData> {
  const snapshot: Node<CourseNodeData> = {
    ...node,
    position: { ...node.position },
    data: { ...node.data },
    style: node.style ? { ...node.style } : undefined,
    positionAbsolute: node.positionAbsolute ? { ...node.positionAbsolute } : undefined,
  };

  snapshot.className = undefined;
  snapshot.selected = undefined;
  snapshot.dragging = undefined;
  snapshot.width = undefined;
  snapshot.height = undefined;
  snapshot.positionAbsolute = undefined;
  (snapshot as any)[internalsSymbol] = undefined;

  return snapshot;
}

function cloneEdgeForSnapshot(edge: Edge): Edge {
  const snapshot: Edge = {
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    style: edge.style ? { ...edge.style } : undefined,
    markerStart: cloneMarker(edge.markerStart),
    markerEnd: cloneMarker(edge.markerEnd),
  };

  snapshot.selected = undefined;
  snapshot.sourceNode = undefined;
  snapshot.targetNode = undefined;

  return snapshot;
}

function cloneMarker(marker: Edge['markerStart'] | Edge['markerEnd']): Edge['markerStart'] {
  if (typeof marker === 'string' || marker === undefined) {
    return marker;
  }
  return { ...marker };
}
