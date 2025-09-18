import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from 'reactflow';
import {
  MarkerType,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';

import type { Graph } from '@course-dag/core';

import { loadSampleGraph } from './sampleData';
import { applyDagreLayout, type LayoutDirection } from '../utils/layout';

export type CourseStatus = 'completed' | 'in_progress' | 'planned' | 'failed' | 'unknown';

export interface CourseNodeData {
  label: string;
  courseId: string;
  title: string;
  credits: number;
  department?: string;
  level?: string;
  term?: string;
  status: CourseStatus;
}

export interface LayoutSettings {
  engine: 'dagre' | 'elk';
  direction: LayoutDirection;
}

interface GraphContextValue {
  nodes: Node<CourseNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  layout: LayoutSettings;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodesDelete: (nodes: Node[]) => void;
  onEdgesDelete: (edges: Edge[]) => void;
  selectNode: (id: string | null) => void;
  updateNode: (id: string, updates: Partial<CourseNodeData>) => void;
  addNode: (node?: Partial<CourseNodeData>) => string;
  deleteNode: (id: string) => void;
  applyLayout: (overrides?: Partial<LayoutSettings>) => void;
}

const GraphContext = createContext<GraphContextValue | undefined>(undefined);

export function GraphProvider({ children }: { children: ReactNode }): JSX.Element {
  const sampleGraph = useMemo<Graph>(() => loadSampleGraph(), []);

  const [layout, setLayout] = useState<LayoutSettings>({ engine: 'dagre', direction: 'LR' });

  const [nodes, setNodes] = useState<Node<CourseNodeData>[]>(() =>
    initialNodes(sampleGraph, layout.direction),
  );
  const [edges, setEdges] = useState<Edge[]>(() => initialEdges(sampleGraph));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const updated = addEdge(
          {
            ...connection,
            id: `e-${Date.now()}`,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        );
        setNodes((nodes) => applyDagreLayout(nodes, updated, { direction: layout.direction }));
        return updated;
      });
    },
    [layout.direction],
  );

  const onNodesDelete = useCallback(
    (toDelete: Node[]) => {
      if (toDelete.length === 0) return;
      const ids = new Set(toDelete.map((node) => node.id));
      const filteredEdges = edges.filter(
        (edge) => !ids.has(edge.source) && !ids.has(edge.target),
      );
      setEdges(filteredEdges);
      setNodes((current) =>
        applyDagreLayout(
          current.filter((node) => !ids.has(node.id)),
          filteredEdges,
          { direction: layout.direction },
        ),
      );
      setSelectedNodeId((current) => (current && ids.has(current) ? null : current));
    },
    [edges, layout.direction],
  );

  const onEdgesDelete = useCallback(
    (toDelete: Edge[]) => {
      if (toDelete.length === 0) return;
      const ids = new Set(toDelete.map((edge) => edge.id));
      const filtered = edges.filter((edge) => !ids.has(edge.id));
      setEdges(filtered);
      setNodes((current) => applyDagreLayout(current, filtered, { direction: layout.direction }));
    },
    [edges, layout.direction],
  );

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<CourseNodeData>) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== id) return node;
        const merged: CourseNodeData = {
          ...node.data,
          ...normalizeNodeUpdates(updates),
        };
        merged.label = `${merged.courseId} · ${merged.title}`;
        return { ...node, data: merged };
      }),
    );
  }, []);

  const addNode = useCallback(
    (node?: Partial<CourseNodeData>) => {
      const id = node?.courseId ?? `course-${Date.now()}`;
      const title = node?.title ?? 'New Course';
      const newNode: Node<CourseNodeData> = {
        id,
        position: { x: 0, y: 0 },
        data: {
          label: `${id} · ${title}`,
          courseId: id,
          title,
          credits: node?.credits ?? 0,
          department: node?.department,
          level: node?.level,
          term: node?.term,
          status: node?.status ?? 'planned',
        },
      };
      setNodes((current) =>
        applyDagreLayout([...current, newNode], edges, { direction: layout.direction }),
      );
      setSelectedNodeId(id);
      return id;
    },
    [edges, layout.direction],
  );

  const deleteNode = useCallback(
    (id: string) => {
      const target = nodes.find((node) => node.id === id);
      if (!target) return;
      onNodesDelete([target]);
    },
    [nodes, onNodesDelete],
  );

  const applyLayout = useCallback(
    (overrides?: Partial<LayoutSettings>) => {
      setLayout((current) => {
        const next: LayoutSettings = { ...current, ...overrides };
        if (next.engine !== 'dagre') {
          next.engine = 'dagre';
        }
        setNodes((currentNodes) => applyDagreLayout(currentNodes, edges, { direction: next.direction }));
        return next;
      });
    },
    [edges],
  );

  const value = useMemo<GraphContextValue>(
    () => ({
      nodes,
      edges,
      selectedNodeId,
      layout,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodesDelete,
      onEdgesDelete,
      selectNode,
      updateNode,
      addNode,
      deleteNode,
      applyLayout,
    }),
    [
      nodes,
      edges,
      selectedNodeId,
      layout,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodesDelete,
      onEdgesDelete,
      selectNode,
      updateNode,
      addNode,
      deleteNode,
      applyLayout,
    ],
  );

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export function useGraph(): GraphContextValue {
  const ctx = useContext(GraphContext);
  if (!ctx) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return ctx;
}

function initialNodes(graph: Graph, direction: LayoutDirection): Node<CourseNodeData>[] {
  const nodes: Node<CourseNodeData>[] = graph.nodes.map((node) => {
    const title = node.title;
    const status = (node.status ?? 'planned') as CourseStatus;
    return {
      id: node.id,
      position: { x: 0, y: 0 },
      data: {
        label: `${node.id} · ${title}`,
        courseId: node.id,
        title,
        credits: node.credits ?? 0,
        department: node.department,
        level: node.level ? String(node.level) : undefined,
        term: node.term,
        status,
      },
    };
  });

  return applyDagreLayout(nodes, initialEdges(graph), { direction });
}

function initialEdges(graph: Graph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.groupingId ? `Group ${edge.groupingId.split('::').pop()}` : undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      groupingId: edge.groupingId,
    },
  }));
}

function normalizeNodeUpdates(updates: Partial<CourseNodeData>): Partial<CourseNodeData> {
  const result: Partial<CourseNodeData> = { ...updates };
  if (updates.credits !== undefined) {
    if (typeof updates.credits === 'string') {
      const parsed = Number(updates.credits);
      result.credits = Number.isFinite(parsed) ? parsed : 0;
    }
  }
  if (updates.title) {
    result.title = updates.title;
  }
  return result;
}
