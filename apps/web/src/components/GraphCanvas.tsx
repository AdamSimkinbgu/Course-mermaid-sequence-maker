import { useCallback } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from 'reactflow';

import { useGraph } from '../state/GraphContext';

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
  } = useGraph();

  const handleSelectionChange = useCallback(
    (selection: OnSelectionChangeParams) => {
      const firstNode = selection.nodes?.[0];
      selectNode(firstNode ? firstNode.id : null);
    },
    [selectNode],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectNode(null);
    },
    [selectNode],
  );

  return (
    <ReactFlow
      fitView
      className="graph-canvas"
      nodes={nodes}
      edges={edges}
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
      <Background gap={24} color="#f3f4f6" variant={BackgroundVariant.Lines} />
    </ReactFlow>
  );
}
