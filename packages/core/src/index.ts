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

// --- Validation helpers ----------------------------------------------------

const nodeTypeEnum = new Set(['course', 'group', 'note']);
const statusEnum = new Set(['completed', 'in_progress', 'planned', 'failed', 'unknown']);

interface GraphLike {
  id?: unknown;
  projectId?: unknown;
  version?: unknown;
  layoutPrefs?: unknown;
  nodes?: unknown;
  edges?: unknown;
  prereqExpressions?: unknown;
}

interface NodeLike {
  id?: unknown;
  nodeType?: unknown;
  title?: unknown;
  credits?: unknown;
  department?: unknown;
  level?: unknown;
  term?: unknown;
  status?: unknown;
  badges?: unknown;
  notes?: unknown;
  groupId?: unknown;
}

interface EdgeLike {
  id?: unknown;
  source?: unknown;
  target?: unknown;
  label?: unknown;
  notes?: unknown;
  groupingId?: unknown;
}

interface PrereqExpressionLike {
  courseId?: unknown;
  expression?: unknown;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGraph(graph: unknown): GraphValidationResult {
  const errors: string[] = [];

  if (typeof graph !== 'object' || graph === null || Array.isArray(graph)) {
    return { valid: false, errors: ['(root) must be an object'] };
  }

  const value = graph as GraphLike;
  if (!isString(value.id)) errors.push('id must be a non-empty string');
  if (!Array.isArray(value.nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(value.edges)) errors.push('edges must be an array');

  const nodeIds = new Set<string>();

  if (Array.isArray(value.nodes)) {
    value.nodes.forEach((node, index) => {
      if (typeof node !== 'object' || node === null || Array.isArray(node)) {
        errors.push(`nodes[${index}] must be an object`);
        return;
      }
      const n = node as NodeLike;
      if (!isString(n.id)) {
        errors.push(`nodes[${index}].id must be a non-empty string`);
      } else {
        nodeIds.add(n.id);
      }
      if (!isString(n.nodeType) || (nodeTypeEnum.size && !nodeTypeEnum.has(n.nodeType))) {
        errors.push(`nodes[${index}].nodeType must be one of ${Array.from(nodeTypeEnum).join(', ')}`);
      }
      if (!isString(n.title)) {
        errors.push(`nodes[${index}].title must be a non-empty string`);
      }
      if (n.credits !== undefined && (typeof n.credits !== 'number' || Number.isNaN(n.credits) || n.credits < 0)) {
        errors.push(`nodes[${index}].credits must be a number >= 0 when provided`);
      }
      if (n.status !== undefined) {
        if (!isString(n.status) || (statusEnum.size && !statusEnum.has(n.status))) {
          errors.push(`nodes[${index}].status must be one of ${Array.from(statusEnum).join(', ')}`);
        }
      }
      if (n.badges !== undefined && !Array.isArray(n.badges)) {
        errors.push(`nodes[${index}].badges must be an array of strings when provided`);
      }
      if (Array.isArray(n.badges) && n.badges.some((badge) => !isString(badge))) {
        errors.push(`nodes[${index}].badges must contain only strings`);
      }
      if (n.groupId !== undefined && !isString(n.groupId)) {
        errors.push(`nodes[${index}].groupId must be a string when provided`);
      }
    });
  }

  if (Array.isArray(value.edges)) {
    value.edges.forEach((edge, index) => {
      if (typeof edge !== 'object' || edge === null || Array.isArray(edge)) {
        errors.push(`edges[${index}] must be an object`);
        return;
      }
      const e = edge as EdgeLike;
      if (!isString(e.id)) errors.push(`edges[${index}].id must be a non-empty string`);
      if (!isString(e.source)) {
        errors.push(`edges[${index}].source must be a non-empty string`);
      } else if (!nodeIds.has(e.source)) {
        errors.push(`edges[${index}].source must reference an existing node id`);
      }
      if (!isString(e.target)) {
        errors.push(`edges[${index}].target must be a non-empty string`);
      } else if (!nodeIds.has(e.target)) {
        errors.push(`edges[${index}].target must reference an existing node id`);
      }
      if (e.groupingId !== undefined && !isString(e.groupingId)) {
        errors.push(`edges[${index}].groupingId must be a string when provided`);
      }
    });
  }

  if (value.prereqExpressions !== undefined) {
    if (!Array.isArray(value.prereqExpressions)) {
      errors.push('prereqExpressions must be an array when provided');
    } else {
      value.prereqExpressions.forEach((expr, index) => {
        if (typeof expr !== 'object' || expr === null || Array.isArray(expr)) {
          errors.push(`prereqExpressions[${index}] must be an object`);
          return;
        }
        const pe = expr as PrereqExpressionLike;
        if (!isString(pe.courseId)) {
          errors.push(`prereqExpressions[${index}].courseId must be a non-empty string`);
        } else if (!nodeIds.has(pe.courseId)) {
          errors.push(`prereqExpressions[${index}].courseId must reference an existing node id`);
        }
        if (!isString(pe.expression)) {
          errors.push(`prereqExpressions[${index}].expression must be a string`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
