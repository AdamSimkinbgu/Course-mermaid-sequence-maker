import type { Edge, Node } from 'reactflow';

import type { LayoutDirection } from '../utils/layout';
import { applyDagreLayout } from '../utils/layout';

import type { CourseNodeData } from './types';

export const DEFAULT_NODE_WIDTH = 220;
export const DEFAULT_NODE_HEIGHT = 120;
export const DEFAULT_NODE_GAP = 48;

export interface NodePositioningConfig {
  nodeWidth?: number;
  nodeHeight?: number;
  gap?: number;
}

export interface GraphBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function enforceNodeSpacing(
  nodes: Node<CourseNodeData>[],
  changedIds: Set<string>,
  { gap = DEFAULT_NODE_GAP, nodeWidth = DEFAULT_NODE_WIDTH, nodeHeight = DEFAULT_NODE_HEIGHT }: NodePositioningConfig = {},
): Node<CourseNodeData>[] {
  if (nodes.length <= 1) return nodes;
  const result = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const nodeA = result[i]!;
      const nodeB = result[j]!;

      const aSize = getNodeDimensions(nodeA, nodeWidth, nodeHeight);
      const bSize = getNodeDimensions(nodeB, nodeWidth, nodeHeight);

      const ax = nodeA.position.x + aSize.width / 2;
      const ay = nodeA.position.y + aSize.height / 2;
      const bx = nodeB.position.x + bSize.width / 2;
      const by = nodeB.position.y + bSize.height / 2;

      let distance = Math.hypot(bx - ax, by - ay);
      if (distance === 0) {
        distance = 0.001;
      }

      const nx = (bx - ax) / distance;
      const ny = (by - ay) / distance;

      const extentA = (Math.abs(nx) * aSize.width) / 2 + (Math.abs(ny) * aSize.height) / 2;
      const extentB = (Math.abs(nx) * bSize.width) / 2 + (Math.abs(ny) * bSize.height) / 2;

      const requiredDistance = extentA + extentB + gap;

      if (distance >= requiredDistance) {
        continue;
      }

      const overlap = (requiredDistance - distance) / 2;

      const aChanged = changedIds.has(nodeA.id);
      const bChanged = changedIds.has(nodeB.id);

      const moveA = (factor: number) => {
        nodeA.position.x -= nx * factor * overlap * 2;
        nodeA.position.y -= ny * factor * overlap * 2;
      };

      const moveB = (factor: number) => {
        nodeB.position.x += nx * factor * overlap * 2;
        nodeB.position.y += ny * factor * overlap * 2;
      };

      if (aChanged && !bChanged) {
        moveB(1);
      } else if (!aChanged && bChanged) {
        moveA(1);
      } else {
        moveA(0.5);
        moveB(0.5);
      }
    }
  }

  return result;
}

export function calculateGraphBounds(nodes: Node<CourseNodeData>[]): GraphBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    const nodeMinX = node.position.x;
    const nodeMinY = node.position.y;
    const nodeMaxX = node.position.x + width;
    const nodeMaxY = node.position.y + height;

    if (nodeMinX < minX) minX = nodeMinX;
    if (nodeMinY < minY) minY = nodeMinY;
    if (nodeMaxX > maxX) maxX = nodeMaxX;
    if (nodeMaxY > maxY) maxY = nodeMaxY;
  });

  return { minX, minY, maxX, maxY };
}

export function getNewNodePosition(
  existing: Node<CourseNodeData>[],
  direction: LayoutDirection,
  { gap = DEFAULT_NODE_GAP, nodeWidth = DEFAULT_NODE_WIDTH, nodeHeight = DEFAULT_NODE_HEIGHT }: NodePositioningConfig = {},
): { x: number; y: number } {
  const bounds = calculateGraphBounds(existing);
  if (!bounds) {
    return { x: 0, y: 0 };
  }

  const horizontalOffset = nodeWidth + gap * 2;
  const verticalOffset = nodeHeight + gap * 2;

  if (direction === 'LR') {
    return { x: bounds.maxX + horizontalOffset, y: bounds.minY };
  }

  return { x: bounds.minX, y: bounds.maxY + verticalOffset };
}

export function relayoutWithSpacing(
  nodes: Node<CourseNodeData>[],
  edges: Edge[],
  direction: LayoutDirection,
  changedIds: Set<string>,
  config?: NodePositioningConfig,
): Node<CourseNodeData>[] {
  const laidOut = applyDagreLayout(nodes, edges, { direction });
  return enforceNodeSpacing(laidOut, changedIds, config);
}

function getNodeDimensions(
  node: Node<CourseNodeData>,
  widthFallback = DEFAULT_NODE_WIDTH,
  heightFallback = DEFAULT_NODE_HEIGHT,
): { width: number; height: number } {
  const width = node.width ?? widthFallback;
  const height = node.height ?? heightFallback;
  return { width, height };
}
