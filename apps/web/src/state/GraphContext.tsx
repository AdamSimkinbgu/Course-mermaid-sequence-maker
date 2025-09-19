import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';

import type { Graph } from '@course-dag/core';

import { loadSampleGraph } from './sampleData';
import { applyDagreLayout, type LayoutDirection } from '../utils/layout';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  enforceNodeSpacing,
  getNewNodePosition,
} from './graphLayout';
import { useGraphHistory } from './useGraphHistory';
import { useGraphAutosave, loadAutosavedSnapshot } from './useGraphAutosave';
import { useExpressionHelpers } from './useExpressionHelpers';
import {
  captureGraphSnapshot,
  cloneEdgeFromSnapshot,
  cloneNodeFromSnapshot,
} from './snapshot';
import {
  formatCourseLabel,
  normalizeNodeUpdates,
  updateCourseNodeData,
} from './nodeTransforms';
import { generateMermaidFromGraph, parseMermaid, type MermaidApplyResult } from './mermaid';
import type {
  AutosaveState,
  CourseNodeData,
  CourseStatus,
  GraphSnapshot,
  LayoutSettings,
  UpdateOptions,
} from './types';

const AUTOSAVE_KEY = 'course-dag-editor/autosave';
const AUTOSAVE_DEBOUNCE_MS = 750;
const HISTORY_INPUT_DEBOUNCE_MS = 350;
const DEFAULT_EDGE_STYLE = { strokeWidth: 3 } as const;
const DEFAULT_EDGE_MARKER = { type: MarkerType.ArrowClosed, width: 20, height: 20 } as const;

interface GraphContextValue {
  nodes: Node<CourseNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  layout: LayoutSettings;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodesDelete: (nodes: Node[]) => void;
  onEdgesDelete: (edges: Edge[]) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  updateNode: (id: string, updates: Partial<CourseNodeData>, options?: UpdateOptions) => void;
  addNode: (node?: Partial<CourseNodeData>) => string;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  updateEdgeNote: (id: string, note: string, options?: UpdateOptions) => void;
  updateEdgeGrouping: (id: string, groupingId: string) => void;
  applyLayout: (overrides?: Partial<LayoutSettings>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  autosaveState: AutosaveState;
  mermaidCode: string;
  applyMermaid: (code: string) => MermaidApplyResult;
  resetGraph: () => void;
  canStartCourse: (id: string) => boolean;
}

const GraphContext = createContext<GraphContextValue | undefined>(undefined);

export function GraphProvider({ children }: { children: ReactNode }): JSX.Element {
  const sampleGraph = useMemo<Graph>(() => loadSampleGraph(), []);

  const [layout, setLayout] = useState<LayoutSettings>({ engine: 'dagre', direction: 'LR' });

  const initialExpressions = useMemo(() => createInitialExpressions(sampleGraph), [sampleGraph]);

  const [expressions, setExpressions] = useState<Map<string, string>>(initialExpressions);

  const [nodes, setNodes] = useState<Node<CourseNodeData>[]>(() =>
    createInitialNodes(sampleGraph, layout.direction),
  );
  const [edges, setEdges] = useState<Edge[]>(() => createInitialEdges(sampleGraph));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const history = useGraphHistory({ debounceMs: HISTORY_INPUT_DEBOUNCE_MS });
  const {
    notifyChange,
    beginTransient,
    endTransient,
    scheduleTransientCommit,
    flushTransient,
    cancelTransient,
    undo: historyUndo,
    redo: historyRedo,
    initialize: initializeHistory,
    isRestoring,
    hasInitialized,
    canUndo,
    canRedo,
  } = history;
  const { getPrerequisiteSet, evaluateCourseEligibility } = useExpressionHelpers(expressions);

  const spacingConfig = useMemo(
    () => ({
      gap: DEFAULT_NODE_GAP,
      nodeWidth: DEFAULT_NODE_WIDTH,
      nodeHeight: DEFAULT_NODE_HEIGHT,
    }),
    [],
  );

  const graphSnapshot = useMemo(
    () => captureGraphSnapshot(nodes, edges, expressions),
    [nodes, edges, expressions],
  );

  const mermaidCode = useMemo(
    () => generateMermaidFromGraph(nodes, edges, layout.direction),
    [nodes, edges, layout.direction],
  );

  const computeStatusMap = useCallback(() => {
    const statusMap = new Map<string, CourseStatus>();
    nodes.forEach((node) => {
      const statusValue = node.data.disabled ? 'failed' : node.data.status;
      statusMap.set(node.id, statusValue);
    });
    return statusMap;
  }, [nodes]);

  const canStartCourse = useCallback(
    (courseId: string) => {
      const statusMap = computeStatusMap();
      return evaluateCourseEligibility(courseId, statusMap);
    },
    [computeStatusMap, evaluateCourseEligibility],
  );

  const nodeVisualSignature = useMemo(
    () =>
      nodes
        .map(
          (node) =>
            `${node.id}:${node.data.status}:${node.data.disabled}:${node.data.title}:${node.data.credits}:${node.data.grade ?? ''}:${node.data.notes ?? ''}`,
        )
        .join('|'),
    [nodes],
  );

  useEffect(() => {
    notifyChange(graphSnapshot);
  }, [notifyChange, graphSnapshot]);

  const autosaveState = useGraphAutosave({
    snapshot: graphSnapshot,
    storageKey: AUTOSAVE_KEY,
    debounceMs: AUTOSAVE_DEBOUNCE_MS,
    isRestoring: isRestoring(),
    enabled: hasInitialized(),
  });

  const restoreSnapshot = useCallback(
    (snapshot: GraphSnapshot) => {
      cancelTransient();
      setExpressions(new Map(snapshot.expressions));
      setEdges(snapshot.edges.map((edge) => cloneEdgeFromSnapshot(edge)));
      setNodes(snapshot.nodes.map((node) => cloneNodeFromSnapshot(node)));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [cancelTransient],
  );

  useEffect(() => {
    const stored = loadAutosavedSnapshot(AUTOSAVE_KEY);
    if (!stored) return;
    initializeHistory(stored);
    restoreSnapshot(stored);
  }, [initializeHistory, restoreSnapshot]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const changedIds = new Set<string>();
      let dragStarted = false;
      let dragEnded = false;

      changes.forEach((change) => {
        if (change.type === 'position') {
          changedIds.add(change.id);
          if (change.dragging === true) {
            dragStarted = true;
          }
          if (change.dragging === false) {
            dragEnded = true;
          }
        }
        if (change.type === 'dimensions') {
          changedIds.add(change.id);
        }
      });

      if (dragStarted) {
        beginTransient('drag');
      }

      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        return enforceNodeSpacing(next, changedIds, spacingConfig);
      });

      if (dragEnded) {
        endTransient();
      }
    },
    [beginTransient, endTransient, spacingConfig],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      flushTransient();
      setEdges((current) => {
        const updated = addEdge(
          {
            ...connection,
            id: `e-${Date.now()}`,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        );
        setNodes((existing) =>
          enforceNodeSpacing(
            applyDagreLayout(existing, updated, { direction: layout.direction }),
            new Set(),
            spacingConfig,
          ),
        );
        return updated.map(applyDefaultEdgeVisuals);
      });
    },
    [flushTransient, layout.direction, spacingConfig],
  );

  const onNodesDelete = useCallback(
    (toDelete: Node[]) => {
      if (toDelete.length === 0) return;
      flushTransient();
      const ids = new Set(toDelete.map((node) => node.id));
      const filteredEdges = edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target));
      setEdges(filteredEdges.map(applyDefaultEdgeVisuals));
      setNodes((current) =>
        enforceNodeSpacing(
          applyDagreLayout(
            current.filter((node) => !ids.has(node.id)),
            filteredEdges,
            { direction: layout.direction },
          ),
          new Set(),
          spacingConfig,
        ),
      );
      setSelectedNodeId((currentSelected) => (currentSelected && ids.has(currentSelected) ? null : currentSelected));
      setExpressions((currentExpressions) => {
        const next = new Map(currentExpressions);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [edges, flushTransient, layout.direction, spacingConfig],
  );

  const onEdgesDelete = useCallback(
    (toDelete: Edge[]) => {
      if (toDelete.length === 0) return;
      flushTransient();
      const ids = new Set(toDelete.map((edge) => edge.id));
      const filtered = edges.filter((edge) => !ids.has(edge.id));
      setEdges(filtered.map(applyDefaultEdgeVisuals));
      setNodes((current) =>
        enforceNodeSpacing(
          applyDagreLayout(current, filtered, { direction: layout.direction }),
          new Set(),
          spacingConfig,
        ),
      );
    },
    [edges, flushTransient, layout.direction, spacingConfig],
  );

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id !== null) {
      setSelectedEdgeId(null);
    }
  }, []);

  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id !== null) {
      setSelectedNodeId(null);
    }
  }, []);

  const updateNode = useCallback(
    (id: string, updates: Partial<CourseNodeData>, options?: UpdateOptions) => {
      if (options?.transient) {
        scheduleTransientCommit();
      } else {
        flushTransient();
      }

      setNodes((current) =>
        current.map((node) => {
          if (node.id !== id) return node;
          const normalized = normalizeNodeUpdates(updates);

          if (
            normalized.status &&
            (normalized.status === 'in_progress' || normalized.status === 'completed') &&
            !canStartCourse(id)
          ) {
            return node;
          }

          const merged = updateCourseNodeData(node.data, normalized);
          return {
            ...node,
            data: merged,
          };
        }),
      );
    },
    [canStartCourse, flushTransient, scheduleTransientCommit],
  );

  const addNode = useCallback(
    (node?: Partial<CourseNodeData>) => {
      flushTransient();
      const id = node?.courseId ?? `course-${Date.now()}`;
      const title = node?.title ?? 'New Course';
      const baseData: CourseNodeData = {
        label: '',
        courseId: id,
        title,
        credits: node?.credits ?? 0,
        department: node?.department,
        level: node?.level,
        term: node?.term,
        status: node?.status ?? 'planned',
        disabled: node?.disabled ?? false,
        grade: node?.grade,
        notes: node?.notes ?? '',
      };
      baseData.label = formatCourseLabel(baseData.courseId, baseData.title);
      const isHorizontal = layout.direction === 'LR';

      setNodes((current) => {
        const position = getNewNodePosition(current, layout.direction, spacingConfig);
        const positionedNode: Node<CourseNodeData> = {
          id,
          position,
          data: baseData,
          type: 'course',
          className: 'course-node course-node--available',
          targetPosition: isHorizontal ? Position.Left : Position.Top,
          sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        };

        return enforceNodeSpacing([...current, positionedNode], new Set([id]), spacingConfig);
      });

      setSelectedNodeId(id);
      setExpressions((currentExpressions) => {
        const next = new Map(currentExpressions);
        if (!next.has(id)) {
          next.set(id, 'NONE');
        }
        return next;
      });
      return id;
    },
    [flushTransient, layout.direction, spacingConfig],
  );

  const deleteNode = useCallback(
    (id: string) => {
      flushTransient();
      const target = nodes.find((node) => node.id === id);
      if (!target) return;
      onNodesDelete([target]);
    },
    [flushTransient, nodes, onNodesDelete],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      flushTransient();
      const target = edges.find((edge) => edge.id === id);
      if (!target) return;
      onEdgesDelete([target]);
    },
    [edges, flushTransient, onEdgesDelete],
  );

  const updateEdgeNote = useCallback(
    (id: string, note: string, options?: UpdateOptions) => {
      if (options?.transient) {
        scheduleTransientCommit();
      } else {
        flushTransient();
      }

      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? applyDefaultEdgeVisuals({
                ...edge,
                data: {
                  ...edge.data,
                  note,
                },
                label: formatEdgeLabel(note, edge.data?.groupingId as string | undefined),
              })
            : edge,
        ),
      );
    },
    [flushTransient, scheduleTransientCommit],
  );

  const updateEdgeGrouping = useCallback(
    (id: string, groupingId: string) => {
      flushTransient();
      const value = groupingId.trim() || undefined;
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? applyDefaultEdgeVisuals({
                ...edge,
                data: {
                  ...edge.data,
                  groupingId: value,
                },
                label: formatEdgeLabel(edge.data?.note as string | undefined, value),
              })
            : edge,
        ),
      );
    },
    [flushTransient],
  );

  const applyLayout = useCallback(
    (overrides?: Partial<LayoutSettings>) => {
      flushTransient();
      setLayout((current) => {
        const next: LayoutSettings = { ...current, ...overrides };
        if (next.engine !== 'dagre') {
          next.engine = 'dagre';
        }
        setNodes((currentNodes) =>
          enforceNodeSpacing(
            applyDagreLayout(currentNodes, edges, { direction: next.direction }),
            new Set(),
            spacingConfig,
          ),
        );
        return next;
      });
    },
    [edges, flushTransient, spacingConfig],
  );

  const undo = useCallback(() => {
    historyUndo(restoreSnapshot);
  }, [historyUndo, restoreSnapshot]);

  const redo = useCallback(() => {
    historyRedo(restoreSnapshot);
  }, [historyRedo, restoreSnapshot]);

  const applyMermaid = useCallback(
    (code: string): MermaidApplyResult => {
      const result = parseMermaid(code);
      if (!result.ok) {
        return { ok: false, errors: result.errors };
      }

      const { graph } = result;

      const existingNodeMap = new Map(nodes.map((node) => [node.id, node]));
      const existingEdgeMap = new Map(
        edges.map((edge) => [`${edge.source}->${edge.target}`, edge]),
      );

      const nextNodesBase: Node<CourseNodeData>[] = graph.nodes.map((parsed) => {
        const courseId = parsed.id.trim();
        const existing = existingNodeMap.get(courseId);
        const baseData: CourseNodeData = existing
          ? { ...existing.data }
          : {
              label: formatCourseLabel(courseId, courseId),
              courseId,
              title: courseId,
              credits: 0,
              department: undefined,
              level: undefined,
              term: undefined,
              status: 'planned',
              disabled: false,
              grade: undefined,
              notes: '',
            };

        if (parsed.label && parsed.label.trim()) {
          const labelSource = parsed.label.replace(/\r/g, '');
          const labelLines = labelSource.split(/\n+/);
          const titleCandidate = labelLines.slice(1).join(' ').trim();
          const nextTitle = titleCandidate || labelLines[0]?.trim() || courseId;
          baseData.title = nextTitle;
        }

        baseData.label = formatCourseLabel(courseId, baseData.title);

        return {
          id: courseId,
          position: { x: 0, y: 0 },
          data: baseData,
          type: existing?.type ?? 'course',
          className: existing?.className ?? 'course-node course-node--available',
          style: existing?.style ? { ...existing.style } : existing?.style,
        };
      });

      const nextEdges: Edge[] = graph.edges.map((edge, index) => {
        const key = `${edge.source}->${edge.target}`;
        const existing = existingEdgeMap.get(key);
        if (existing) {
          return applyDefaultEdgeVisuals({
            ...existing,
            id: existing.id,
            data: existing.data ? { ...existing.data } : {},
            label: formatEdgeLabel(
              existing.data?.note as string | undefined,
              existing.data?.groupingId as string | undefined,
            ),
          });
        }
        return applyDefaultEdgeVisuals({
          id: `mermaid-${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          markerEnd: { type: MarkerType.ArrowClosed },
          data: {},
          label: formatEdgeLabel(undefined, undefined),
        });
      });

      const expressionsMap = new Map(expressions);
      nextNodesBase.forEach((node) => {
        if (!expressionsMap.has(node.id)) {
          expressionsMap.set(node.id, 'NONE');
        }
      });
      Array.from(expressionsMap.keys()).forEach((key) => {
        if (!nextNodesBase.find((node) => node.id === key)) {
          expressionsMap.delete(key);
        }
      });

      flushTransient();

      setLayout((current) => ({ ...current, direction: graph.direction }));
      setExpressions(expressionsMap);
      setEdges(nextEdges);
      setNodes(
        enforceNodeSpacing(
          applyDagreLayout(nextNodesBase, nextEdges, { direction: graph.direction }),
          new Set(),
          spacingConfig,
        ),
      );
      setSelectedNodeId(null);
      setSelectedEdgeId(null);

      return { ok: true };
    },
    [applyDagreLayout, edges, expressions, flushTransient, nodes, spacingConfig],
  );

  const resetGraph = useCallback(() => {
    flushTransient();
    const graph = loadSampleGraph();
    const defaultLayout: LayoutSettings = { engine: 'dagre', direction: 'LR' };
    const expressionsMap = createInitialExpressions(graph);
    const nextEdges = createInitialEdges(graph);
    const nextNodes = createInitialNodes(graph, defaultLayout.direction);

    setLayout(defaultLayout);
    setExpressions(expressionsMap);
    setEdges(nextEdges);
    setNodes(nextNodes);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);

    const snapshot = captureGraphSnapshot(nextNodes, nextEdges, expressionsMap);
    initializeHistory(snapshot);
  }, [flushTransient, initializeHistory]);

  useEffect(() => {
    setNodes((current) => {
      const statusMap = new Map<string, CourseStatus>();
      current.forEach((node) => {
        const statusValue = node.data.disabled ? 'failed' : node.data.status;
        statusMap.set(node.id, statusValue);
      });

      const eligibilityMap = new Map<string, boolean>();
      current.forEach((node) => {
        const eligible = evaluateCourseEligibility(node.id, statusMap);
        eligibilityMap.set(node.id, eligible);
      });

      const prereqSet = selectedNodeId ? getPrerequisiteSet(selectedNodeId) : new Set<string>();
      if (selectedNodeId) {
        prereqSet.delete(selectedNodeId);
      }

      let changed = false;
      const next = current.map((node) => {
        const className = buildClassName(node, {
          eligibilityMap,
          selectedNodeId,
          prereqSet,
        });
        const label = formatCourseLabel(node.data.courseId, node.data.title);
        if (node.className !== className || node.data.label !== label) {
          changed = true;
          return {
            ...node,
            className,
            data: {
              ...node.data,
              label,
            },
          };
        }
        return node;
      });

      return changed ? next : current;
    });
  }, [evaluateCourseEligibility, getPrerequisiteSet, selectedNodeId, nodeVisualSignature]);

  const value = useMemo<GraphContextValue>(
    () => ({
      nodes,
      edges,
      selectedNodeId,
      selectedEdgeId,
      layout,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodesDelete,
      onEdgesDelete,
      selectNode,
      selectEdge,
      updateNode,
      addNode,
      deleteNode,
      deleteEdge,
      updateEdgeNote,
      updateEdgeGrouping,
      applyLayout,
      undo,
      redo,
      canUndo,
      canRedo,
      autosaveState,
      mermaidCode,
      applyMermaid,
      resetGraph,
      canStartCourse,
    }),
    [
      nodes,
      edges,
      selectedNodeId,
      selectedEdgeId,
      layout,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodesDelete,
      onEdgesDelete,
      selectNode,
      selectEdge,
      updateNode,
      addNode,
      deleteNode,
      deleteEdge,
      updateEdgeNote,
      updateEdgeGrouping,
      applyLayout,
      undo,
      redo,
      canUndo,
      canRedo,
      autosaveState,
      mermaidCode,
      applyMermaid,
      resetGraph,
      canStartCourse,
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

function createInitialNodes(graph: Graph, direction: LayoutDirection): Node<CourseNodeData>[] {
  const nodes: Node<CourseNodeData>[] = graph.nodes.map((node) => {
    const status = (node.status ?? 'planned') as CourseStatus;
    const data: CourseNodeData = {
      label: formatCourseLabel(node.id, node.title),
      courseId: node.id,
      title: node.title,
      credits: node.credits ?? 0,
      department: node.department,
      level: node.level ? String(node.level) : undefined,
      term: node.term,
      status,
      disabled: false,
      grade: undefined,
      notes: '',
    };
    return {
      id: node.id,
      position: { x: 0, y: 0 },
      data,
      type: 'course',
      className: 'course-node course-node--available',
    };
  });

  const laidOut = applyDagreLayout(nodes, createInitialEdges(graph), { direction });
  return enforceNodeSpacing(laidOut, new Set(), {
    gap: DEFAULT_NODE_GAP,
    nodeWidth: DEFAULT_NODE_WIDTH,
    nodeHeight: DEFAULT_NODE_HEIGHT,
  });
}

function createInitialEdges(graph: Graph): Edge[] {
  return graph.edges.map((edge) =>
    applyDefaultEdgeVisuals({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.groupingId ? `Group ${edge.groupingId.split('::').pop()}` : undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        groupingId: edge.groupingId,
      },
    }),
  );
}

function createInitialExpressions(graph: Graph): Map<string, string> {
  return new Map<string, string>(
    graph.prereqExpressions?.map(({ courseId, expression }) => [courseId, expression]) ?? [],
  );
}

interface NodeVisualContext {
  eligibilityMap: Map<string, boolean>;
  selectedNodeId: string | null;
  prereqSet: Set<string>;
}

function applyDefaultEdgeVisuals(edge: Edge): Edge {
  const markerEnd =
    typeof edge.markerEnd === 'string' || edge.markerEnd === undefined
      ? { ...DEFAULT_EDGE_MARKER }
      : { ...DEFAULT_EDGE_MARKER, ...edge.markerEnd };
  const style = edge.style ? { ...DEFAULT_EDGE_STYLE, ...edge.style } : { ...DEFAULT_EDGE_STYLE };
  return {
    ...edge,
    markerEnd,
    style,
  };
}

function formatEdgeLabel(note?: string, groupingId?: string): string | undefined {
  if (note && note.trim()) return note.trim();
  if (groupingId && groupingId.trim()) {
    const parts = groupingId.trim().split('::').pop();
    return parts ? `Group ${parts}` : groupingId.trim();
  }
  return undefined;
}

function buildClassName(
  node: Node<CourseNodeData>,
  { eligibilityMap, selectedNodeId, prereqSet }: NodeVisualContext,
): string {
  const classes = ['course-node'];

  const isDisabled = node.data.disabled;
  const isCompleted = node.data.status === 'completed';
  const isFailed = node.data.status === 'failed';
  const eligible = eligibilityMap.get(node.id) ?? true;

  if (isDisabled) {
    classes.push('course-node--disabled', 'course-node--failed');
  } else if (isFailed) {
    classes.push('course-node--failed');
  } else if (isCompleted) {
    classes.push('course-node--completed');
  } else if (!eligible) {
    classes.push('course-node--blocked');
  } else {
    classes.push('course-node--available');
  }

  if (selectedNodeId === node.id) {
    classes.push('course-node--current');
  } else if (selectedNodeId && prereqSet.has(node.id)) {
    classes.push('course-node--prereq');
  }

  return classes.join(' ');
}

export type { CourseStatus, CourseNodeData, LayoutSettings } from './types';
