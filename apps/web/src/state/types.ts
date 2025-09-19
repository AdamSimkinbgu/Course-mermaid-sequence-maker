import type { Edge, Node } from 'reactflow';

import type { LayoutDirection } from '../utils/layout';

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

export type AutosaveState = 'idle' | 'saving' | 'saved';

export interface UpdateOptions {
  transient?: boolean;
}

export interface GraphSnapshot {
  nodes: Node<CourseNodeData>[];
  edges: Edge[];
  expressions: [string, string][];
}
