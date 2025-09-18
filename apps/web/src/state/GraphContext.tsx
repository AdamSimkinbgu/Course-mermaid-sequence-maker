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
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
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
  updateNode: (id: string, updates: Partial<CourseNodeData>) => void;
  addNode: (node?: Partial<CourseNodeData>) => string;
  deleteNode: (id: string) => void;
  updateEdgeNote: (id: string, note: string) => void;
  applyLayout: (overrides?: Partial<LayoutSettings>) => void;
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
      setExpressions((currentExpressions) => {
        const next = new Map(currentExpressions);
        ids.forEach((id) => next.delete(id));
        return next;
      });
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

  const updateNode = useCallback((id: string, updates: Partial<CourseNodeData>) => {
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
  }, []);

  const addNode = useCallback(
    (node?: Partial<CourseNodeData>) => {
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
      const newNode: Node<CourseNodeData> = {
        id,
        position: { x: 0, y: 0 },
        data: baseData,
        type: 'course',
        className: 'course-node course-node--available',
      };
      setNodes((current) =>
        applyDagreLayout([...current, newNode], edges, { direction: layout.direction }),
      );
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

  const updateEdgeNote = useCallback((id: string, note: string) => {
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
  }, []);

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
