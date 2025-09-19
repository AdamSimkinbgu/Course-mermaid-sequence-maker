import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  internalsSymbol,
} from 'reactflow';

import type { Graph } from '@course-dag/core';
import {
  parseExpression,
  evaluateAst,
  referencedCourseIds,
  type PrereqAst,
} from '@course-dag/expression';

import { loadSampleGraph } from './sampleData';
import { applyDagreLayout, type LayoutDirection } from '../utils/layout';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const NODE_GAP = 48;
const AUTOSAVE_KEY = 'course-dag-editor/autosave';
const AUTOSAVE_DEBOUNCE_MS = 750;
const TRANSIENT_HISTORY_DEBOUNCE_MS = 350;
type AutosaveState = 'idle' | 'saving' | 'saved';

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
  disabled: boolean;
  grade?: string;
  notes?: string;
}

export interface LayoutSettings {
  engine: 'dagre' | 'elk';
  direction: LayoutDirection;
}

interface UpdateOptions {
  transient?: boolean;
}

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
  updateEdgeNote: (id: string, note: string, options?: UpdateOptions) => void;
  applyLayout: (overrides?: Partial<LayoutSettings>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  autosaveState: AutosaveState;
}

const GraphContext = createContext<GraphContextValue | undefined>(undefined);

export function GraphProvider({ children }: { children: ReactNode }): JSX.Element {
  const sampleGraph = useMemo<Graph>(() => loadSampleGraph(), []);

  const [layout, setLayout] = useState<LayoutSettings>({ engine: 'dagre', direction: 'LR' });

  const initialExpressions = useMemo(() => {
    return new Map<string, string>(
      sampleGraph.prereqExpressions?.map(({ courseId, expression }) => [courseId, expression]) ??
        [],
    );
  }, [sampleGraph]);

  const [expressions, setExpressions] = useState<Map<string, string>>(initialExpressions);
  const expressionAstCacheRef = useRef<Map<string, PrereqAst>>(new Map());

  const [nodes, setNodes] = useState<Node<CourseNodeData>[]>(() =>
    initialNodes(sampleGraph, layout.direction),
  );
  const [edges, setEdges] = useState<Edge[]>(() => initialEdges(sampleGraph));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const historyRef = useRef<GraphSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const lastSerializedRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  const isApplyingTransientChangeRef = useRef(false);
  const historyGuardModeRef = useRef<'idle' | 'drag' | 'input'>('idle');
  const hasInitializedHistoryRef = useRef(false);
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });
  const autosaveTimerRef = useRef<number | null>(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saved');
  const latestStateRef = useRef<
    | {
        nodes: Node<CourseNodeData>[];
        edges: Edge[];
        expressions: Map<string, string>;
      }
    | null
  >(null);
  const transientHistoryTimerRef = useRef<number | null>(null);

  const updateHistoryStatus = useCallback(() => {
    const canUndo = historyIndexRef.current > 0;
    const canRedo =
      historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1;
    setHistoryStatus({ canUndo, canRedo });
  }, []);

  const recordSnapshot = useCallback(
    (nodesArg: Node<CourseNodeData>[], edgesArg: Edge[], expressionsArg: Map<string, string>) => {
      const snapshot = captureSnapshot(nodesArg, edgesArg, expressionsArg);
      const serialized = serializeSnapshot(snapshot);

      if (!hasInitializedHistoryRef.current) {
        historyRef.current = [snapshot];
        historyIndexRef.current = 0;
        lastSerializedRef.current = serialized;
        hasInitializedHistoryRef.current = true;
        updateHistoryStatus();
        return;
      }

      if (serialized === lastSerializedRef.current) return;

      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(snapshot);
      historyIndexRef.current = historyRef.current.length - 1;
      lastSerializedRef.current = serialized;
      updateHistoryStatus();
    },
    [updateHistoryStatus],
  );

  const cancelTransientHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (transientHistoryTimerRef.current !== null) {
      window.clearTimeout(transientHistoryTimerRef.current);
      transientHistoryTimerRef.current = null;
    }
  }, []);

  const flushTransientHistoryNow = useCallback(() => {
    if (historyGuardModeRef.current !== 'input') {
      cancelTransientHistory();
      return;
    }

    cancelTransientHistory();
    if (!isApplyingTransientChangeRef.current) {
      historyGuardModeRef.current = 'idle';
      return;
    }

    isApplyingTransientChangeRef.current = false;
    historyGuardModeRef.current = 'idle';
    const latest = latestStateRef.current;
    if (!latest) return;
    recordSnapshot(latest.nodes, latest.edges, latest.expressions);
  }, [cancelTransientHistory, recordSnapshot]);

  const scheduleTransientHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    cancelTransientHistory();
    isApplyingTransientChangeRef.current = true;
    historyGuardModeRef.current = 'input';
    transientHistoryTimerRef.current = window.setTimeout(() => {
      transientHistoryTimerRef.current = null;
      if (historyGuardModeRef.current !== 'input') {
        return;
      }
      if (!isApplyingTransientChangeRef.current) {
        historyGuardModeRef.current = 'idle';
        return;
      }
      isApplyingTransientChangeRef.current = false;
      historyGuardModeRef.current = 'idle';
      const latest = latestStateRef.current;
      if (!latest) return;
      recordSnapshot(latest.nodes, latest.edges, latest.expressions);
    }, TRANSIENT_HISTORY_DEBOUNCE_MS);
  }, [cancelTransientHistory, recordSnapshot]);

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
    return () => {
      cancelTransientHistory();
      isApplyingTransientChangeRef.current = false;
      historyGuardModeRef.current = 'idle';
    };
  }, [cancelTransientHistory]);

  useEffect(() => {
    latestStateRef.current = { nodes, edges, expressions };

    if (isRestoringRef.current) return;
    if (isApplyingTransientChangeRef.current) return;

    recordSnapshot(nodes, edges, expressions);
  }, [nodes, edges, expressions, recordSnapshot]);

  const getExpression = useCallback(
    (courseId: string) => expressions.get(courseId) ?? 'NONE',
    [expressions],
  );

  const getAst = useCallback(
    (courseId: string) => {
      const expression = getExpression(courseId);
      const cacheKey = `${courseId}::${expression}`;
      const cached = expressionAstCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const ast = parseExpression(expression);
      expressionAstCacheRef.current.set(cacheKey, ast);
      return ast;
    },
    [getExpression],
  );

  const getPrerequisiteSet = useCallback(
    (courseId: string) => {
      const expression = getExpression(courseId);
      if (!hasMeaningfulExpression(expression)) {
        return new Set<string>();
      }
      const ast = getAst(courseId);
      return new Set(referencedCourseIds(ast));
    },
    [getAst, getExpression],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const changedIds = new Set<string>();
      changes.forEach((change) => {
        if (change.type === 'position' || change.type === 'dimensions') {
          changedIds.add(change.id);
        }
      });

      const hasPositionChange = changes.some((change) => change.type === 'position');
      const hasDraggingUpdate = changes.some(
        (change) => change.type === 'position' && change.dragging === true,
      );
      const hasDragEnd = changes.some(
        (change) => change.type === 'position' && change.dragging === false,
      );

      if (hasDraggingUpdate) {
        isApplyingTransientChangeRef.current = true;
        historyGuardModeRef.current = 'drag';
      }

      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        return enforceNodeSpacing(next, changedIds);
      });

      if (
        hasDragEnd ||
        (!hasDraggingUpdate && hasPositionChange && isApplyingTransientChangeRef.current)
      ) {
        isApplyingTransientChangeRef.current = false;
        historyGuardModeRef.current = 'idle';
      }
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
      flushTransientHistoryNow();
      setEdges((current) => {
        const updated = addEdge(
          {
            ...connection,
            id: `e-${Date.now()}`,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        );
      setNodes((nodes) =>
        enforceNodeSpacing(
          applyDagreLayout(nodes, updated, { direction: layout.direction }),
          new Set(),
        ),
      );
      return updated;
    });
  },
  [flushTransientHistoryNow, layout.direction],
  );

  const onNodesDelete = useCallback(
    (toDelete: Node[]) => {
      if (toDelete.length === 0) return;
      flushTransientHistoryNow();
      const ids = new Set(toDelete.map((node) => node.id));
      const filteredEdges = edges.filter(
        (edge) => !ids.has(edge.source) && !ids.has(edge.target),
      );
      setEdges(filteredEdges);
      setNodes((current) =>
        enforceNodeSpacing(
          applyDagreLayout(
            current.filter((node) => !ids.has(node.id)),
            filteredEdges,
            { direction: layout.direction },
          ),
          new Set(),
        ),
      );
      setSelectedNodeId((current) => (current && ids.has(current) ? null : current));
      setExpressions((currentExpressions) => {
        const next = new Map(currentExpressions);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [edges, flushTransientHistoryNow, layout.direction],
  );

  const onEdgesDelete = useCallback(
    (toDelete: Edge[]) => {
      if (toDelete.length === 0) return;
      flushTransientHistoryNow();
      const ids = new Set(toDelete.map((edge) => edge.id));
      const filtered = edges.filter((edge) => !ids.has(edge.id));
      setEdges(filtered);
      setNodes((current) =>
        enforceNodeSpacing(
          applyDagreLayout(current, filtered, { direction: layout.direction }),
          new Set(),
        ),
      );
    },
    [edges, flushTransientHistoryNow, layout.direction],
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
        scheduleTransientHistory();
      } else {
        flushTransientHistoryNow();
      }

      setNodes((current) =>
        current.map((node) => {
          if (node.id !== id) return node;
          const normalized = normalizeNodeUpdates(updates);
          const merged: CourseNodeData = {
            ...node.data,
            ...normalized,
          };

          if (normalized.grade !== undefined) {
            const gradeStatus = deriveStatusFromGrade(merged.grade);
            if (gradeStatus && !merged.disabled) {
              merged.status = gradeStatus;
            } else if (!gradeStatus && !merged.disabled && merged.status === 'failed') {
              merged.status = 'planned';
            }
          }

          if (normalized.disabled !== undefined) {
            if (!merged.disabled) {
              if (merged.grade) {
                const gradeStatus = deriveStatusFromGrade(merged.grade);
                if (gradeStatus) {
                  merged.status = gradeStatus;
                }
              }
            }
          }

          merged.label = formatLabel(merged.courseId, merged.title);
          return { ...node, data: merged };
        }),
      );
    },
    [flushTransientHistoryNow, scheduleTransientHistory],
  );

  const addNode = useCallback(
    (node?: Partial<CourseNodeData>) => {
      flushTransientHistoryNow();
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
      baseData.label = formatLabel(baseData.courseId, baseData.title);
      const isHorizontal = layout.direction === 'LR';

      setNodes((current) => {
        const position = getNewNodePosition(current, layout.direction);
        const positionedNode: Node<CourseNodeData> = {
          id,
          position,
          data: baseData,
          type: 'course',
          className: 'course-node course-node--available',
          targetPosition: isHorizontal ? Position.Left : Position.Top,
          sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        };

        return enforceNodeSpacing([...current, positionedNode], new Set([id]));
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
    [flushTransientHistoryNow, layout.direction],
  );

  const deleteNode = useCallback(
    (id: string) => {
      flushTransientHistoryNow();
      const target = nodes.find((node) => node.id === id);
      if (!target) return;
      onNodesDelete([target]);
    },
    [flushTransientHistoryNow, nodes, onNodesDelete],
  );

  const updateEdgeNote = useCallback(
    (id: string, note: string, options?: UpdateOptions) => {
      if (options?.transient) {
        scheduleTransientHistory();
      } else {
        flushTransientHistoryNow();
      }

      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  note,
                },
                label: note
                  ? note
                  : edge.data?.groupingId
                  ? `Group ${(edge.data.groupingId as string).split('::').pop()}`
                  : undefined,
              }
            : edge,
        ),
      );
    },
    [flushTransientHistoryNow, scheduleTransientHistory],
  );

  const restoreSnapshot = useCallback(
    (snapshot: GraphSnapshot) => {
      cancelTransientHistory();
      isApplyingTransientChangeRef.current = false;
      historyGuardModeRef.current = 'idle';
      isRestoringRef.current = true;
      setExpressions(new Map(snapshot.expressions));
      setEdges(snapshot.edges.map((edge) => cloneEdge(edge)));
      setNodes(snapshot.nodes.map((node) => cloneNode(node)));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      lastSerializedRef.current = serializeSnapshot(snapshot);
      setAutosaveState('saved');
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    },
    [cancelTransientHistory],
  );

  const undo = useCallback(() => {
    flushTransientHistoryNow();
    if (historyIndexRef.current <= 0) return;
    const nextIndex = historyIndexRef.current - 1;
    const snapshot = historyRef.current[nextIndex];
    historyIndexRef.current = nextIndex;
    restoreSnapshot(snapshot);
    updateHistoryStatus();
  }, [flushTransientHistoryNow, restoreSnapshot, updateHistoryStatus]);

  const redo = useCallback(() => {
    flushTransientHistoryNow();
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const nextIndex = historyIndexRef.current + 1;
    const snapshot = historyRef.current[nextIndex];
    historyIndexRef.current = nextIndex;
    restoreSnapshot(snapshot);
    updateHistoryStatus();
  }, [flushTransientHistoryNow, restoreSnapshot, updateHistoryStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const snapshot = JSON.parse(raw) as GraphSnapshot;
      historyRef.current = [snapshot];
      historyIndexRef.current = 0;
      hasInitializedHistoryRef.current = true;
      restoreSnapshot(snapshot);
      updateHistoryStatus();
    } catch (error) {
      console.warn('Failed to load autosave snapshot', error);
      window.localStorage.removeItem(AUTOSAVE_KEY);
    }
  }, [restoreSnapshot, updateHistoryStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasInitializedHistoryRef.current) return;
    if (isRestoringRef.current) return;

    const snapshot = captureSnapshot(nodes, edges, expressions);
    const serialized = serializeSnapshot(snapshot);

    if (serialized === lastSerializedRef.current) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveState('saving');
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(AUTOSAVE_KEY, serialized);
        setAutosaveState('saved');
      } catch (error) {
        console.warn('Autosave failed', error);
        setAutosaveState('idle');
      }
      autosaveTimerRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
        setAutosaveState('idle');
      }
    };
  }, [nodes, edges, expressions]);

  useEffect(() => {
    setNodes((current) => {
      const statusMap = new Map<string, CourseStatus>();
      current.forEach((node) => {
        const statusValue = node.data.disabled ? 'failed' : node.data.status;
        statusMap.set(node.id, statusValue);
      });

      const eligibilityMap = new Map<string, boolean>();
      current.forEach((node) => {
        const expression = getExpression(node.id);
        let eligible = true;
        if (hasMeaningfulExpression(expression)) {
          const ast = getAst(node.id);
          eligible = evaluateAst(ast, statusMap);
        }
        eligibilityMap.set(node.id, eligible);
      });

      const prereqSet = selectedNodeId
        ? getPrerequisiteSet(selectedNodeId)
        : new Set<string>();
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
        const label = formatLabel(node.data.courseId, node.data.title);
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
  }, [getAst, getExpression, getPrerequisiteSet, selectedNodeId, nodeVisualSignature]);

  const applyLayout = useCallback(
    (overrides?: Partial<LayoutSettings>) => {
      flushTransientHistoryNow();
      setLayout((current) => {
        const next: LayoutSettings = { ...current, ...overrides };
        if (next.engine !== 'dagre') {
          next.engine = 'dagre';
        }
        setNodes((currentNodes) => applyDagreLayout(currentNodes, edges, { direction: next.direction }));
        return next;
      });
    },
    [edges, flushTransientHistoryNow],
  );

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
      updateEdgeNote,
      applyLayout,
      undo,
      redo,
      canUndo: historyStatus.canUndo,
      canRedo: historyStatus.canRedo,
      autosaveState,
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
      updateEdgeNote,
      applyLayout,
      undo,
      redo,
      historyStatus,
      autosaveState,
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
    const data: CourseNodeData = {
      label: formatLabel(node.id, title),
      courseId: node.id,
      title,
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
  if (updates.grade !== undefined) {
    const trimmed = updates.grade?.toString().trim() ?? '';
    result.grade = trimmed ? trimmed.toUpperCase() : undefined;
  }
  if (updates.notes !== undefined) {
    result.notes = updates.notes;
  }
  if (updates.disabled !== undefined) {
    result.disabled = updates.disabled;
  }
  if (updates.status) {
    result.status = updates.status;
  }
  return result;
}

function formatLabel(courseId: string, title: string): string {
  return `${courseId}\n${title}`;
}

interface NodeVisualContext {
  eligibilityMap: Map<string, boolean>;
  selectedNodeId: string | null;
  prereqSet: Set<string>;
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

function hasMeaningfulExpression(expression: string): boolean {
  if (!expression) return false;
  return expression.trim().toUpperCase() !== 'NONE';
}

function deriveStatusFromGrade(grade?: string): CourseStatus | null {
  if (!grade) return null;
  const normalized = grade.trim().toUpperCase();
  if (!normalized) return null;

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    return numeric >= 60 ? 'completed' : 'failed';
  }

  const score = letterGradeToScore(normalized);
  if (score !== null) {
    return score >= 60 ? 'completed' : 'failed';
  }

  return null;
}

function letterGradeToScore(letter: string): number | null {
  const mapping: Record<string, number> = {
    'A+': 98,
    A: 95,
    'A-': 91,
    'B+': 88,
    B: 85,
    'B-': 81,
    'C+': 78,
    C: 75,
    'C-': 71,
    'D+': 68,
    D: 65,
    'D-': 61,
    F: 50,
  };

  return mapping[letter] ?? null;
}

interface GraphSnapshot {
  nodes: Node<CourseNodeData>[];
  edges: Edge[];
  expressions: [string, string][];
}

function captureSnapshot(
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
    markerStart:
      typeof edge.markerStart === 'string'
        ? edge.markerStart
        : edge.markerStart
        ? { ...edge.markerStart }
        : undefined,
    markerEnd:
      typeof edge.markerEnd === 'string'
        ? edge.markerEnd
        : edge.markerEnd
        ? { ...edge.markerEnd }
        : undefined,
  };

  snapshot.selected = undefined;
  snapshot.sourceNode = undefined;
  snapshot.targetNode = undefined;

  return snapshot;
}

function serializeSnapshot(snapshot: GraphSnapshot): string {
  return JSON.stringify(snapshot);
}

function cloneNode(node: Node<CourseNodeData>): Node<CourseNodeData> {
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

function cloneEdge(edge: Edge): Edge {
  return {
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    style: edge.style ? { ...edge.style } : undefined,
    markerStart:
      typeof edge.markerStart === 'string'
        ? edge.markerStart
        : edge.markerStart
        ? { ...edge.markerStart }
        : undefined,
    markerEnd:
      typeof edge.markerEnd === 'string'
        ? edge.markerEnd
        : edge.markerEnd
        ? { ...edge.markerEnd }
        : undefined,
  };
}

interface GraphBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function calculateGraphBounds(nodes: Node<CourseNodeData>[]): GraphBounds | null {
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

function getNewNodePosition(
  existing: Node<CourseNodeData>[],
  direction: LayoutDirection,
): { x: number; y: number } {
  const bounds = calculateGraphBounds(existing);
  if (!bounds) {
    return { x: 0, y: 0 };
  }

  const horizontalOffset = NODE_WIDTH + NODE_GAP * 2;
  const verticalOffset = NODE_HEIGHT + NODE_GAP * 2;

  if (direction === 'LR') {
    return { x: bounds.maxX + horizontalOffset, y: bounds.minY };
  }

  return { x: bounds.minX, y: bounds.maxY + verticalOffset };
}

function enforceNodeSpacing(
  nodes: Node<CourseNodeData>[],
  changedIds: Set<string>,
  gap = NODE_GAP,
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

      const aSize = getNodeDimensions(nodeA);
      const bSize = getNodeDimensions(nodeB);

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

      const extentA = Math.abs(nx) * aSize.width / 2 + Math.abs(ny) * aSize.height / 2;
      const extentB = Math.abs(nx) * bSize.width / 2 + Math.abs(ny) * bSize.height / 2;

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

function getNodeDimensions(node: Node<CourseNodeData>): { width: number; height: number } {
  const width = node.width ?? NODE_WIDTH;
  const height = node.height ?? NODE_HEIGHT;
  return { width, height };
}
