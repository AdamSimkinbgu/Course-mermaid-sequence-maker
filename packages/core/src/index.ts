export type CourseId = string;

export type NodeType = 'course' | 'group' | 'note';

export interface GraphNode {
  id: CourseId;
  nodeType: NodeType;
  title: string;
  credits?: number; // >= 0
  department?: string;
  level?: string | number;
  term?: string;
  status?: 'completed' | 'in_progress' | 'planned' | 'failed' | 'unknown';
  badges?: string[];
  notes?: string;
  groupId?: string;
}

export interface GraphEdge {
  id: string;
  source: CourseId;
  target: CourseId;
  label?: string;
  notes?: string;
  groupingId?: string;
}

export interface PrereqExpression {
  courseId: CourseId;
  expression: string;
}

export interface Graph {
  id: string;
  projectId?: string;
  version?: number;
  layoutPrefs?: { direction?: 'LR' | 'TD'; engine?: 'ELK' | 'Dagre' };
  nodes: GraphNode[];
  edges: GraphEdge[];
  prereqExpressions?: PrereqExpression[];
}

export const VERSION = '0.1.0';
