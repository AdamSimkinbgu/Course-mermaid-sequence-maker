import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  MarkerType,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from 'reactflow';

import { useGraph } from '../state/GraphContext';
import { CourseNode } from './nodes/CourseNode';
import { useTheme } from '../theme/ThemeContext';
import { SmoothStepEdge } from 'reactflow';

export function GraphCanvas(): JSX.Element {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodesDelete,
    onEdgesDelete,
    selectNode,
    selectEdge,
    undo,
    redo,
  } = useGraph();
  const { theme } = useTheme();

  const handleSelectionChange = useCallback(
    (selection: OnSelectionChangeParams) => {
      const firstNode = selection.nodes?.[0];
      const firstEdge = selection.edges?.[0];
      selectNode(firstNode ? firstNode.id : null);
      selectEdge(firstEdge ? firstEdge.id : null);
    },
    [selectNode, selectEdge],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
      selectEdge(null);
    },
    [selectNode, selectEdge],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectNode(null);
      selectEdge(edge.id);
    },
    [selectNode, selectEdge],
  );

  const nodeTypes = useMemo(() => ({ course: CourseNode }), []);
  const edgeTypes = useMemo(() => ({ smart: SmoothStepEdge }), []);
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'bezier' as const,
      style: { strokeWidth: 3 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
    }),
    [],
  );

  const backgroundColor = theme === 'dark' ? '#1f2735' : '#e2e8f0';

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.altKey) return;

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <ReactFlow
      fitView
      className="graph-canvas"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onSelectionChange={handleSelectionChange}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
    >
      <Panel position="top-left" className="graph-panel">
        <strong>Course Graph</strong>
        <span>Drag nodes or connect courses to explore prerequisites.</span>
      </Panel>
      <MiniMap zoomable pannable />
      <Controls position="bottom-left" showInteractive />
      <Background gap={24} color={backgroundColor} variant={BackgroundVariant.Lines} />
    </ReactFlow>
  );
}
