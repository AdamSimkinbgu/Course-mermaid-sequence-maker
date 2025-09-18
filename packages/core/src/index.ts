import { readFileSync } from 'node:fs';

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  $ref?: string;
  minimum?: number;
};

type GraphJsonSchema = JsonSchema & { $defs?: Record<string, JsonSchema> };

const schemaUrl = new URL('../../../schema/graph.schema.json', import.meta.url);
const graphSchema = JSON.parse(readFileSync(schemaUrl, { encoding: 'utf8' })) as GraphJsonSchema;
const schemaDefinitions = graphSchema.$defs ?? {};

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

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGraph(graph: unknown): GraphValidationResult {
  const errors: string[] = [];
  validateAgainstSchema(graphSchema, graph, '(root)', errors);

  if (errors.length === 0 && isGraph(graph)) {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    graph.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source)) {
        errors.push(`edges[${index}].source must reference an existing node id`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`edges[${index}].target must reference an existing node id`);
      }
      if (edge.groupingId !== undefined && typeof edge.groupingId !== 'string') {
        errors.push(`edges[${index}].groupingId must be a string when provided`);
      }
    });

    graph.prereqExpressions?.forEach((expr, index) => {
      if (!nodeIds.has(expr.courseId)) {
        errors.push(`prereqExpressions[${index}].courseId must reference an existing node id`);
      }
      if (typeof expr.expression !== 'string') {
        errors.push(`prereqExpressions[${index}].expression must be a string`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateAgainstSchema(schema: JsonSchema, value: unknown, path: string, errors: string[]): void {
  const mergedSchema = mergeSchema(schema);

  const types = getSchemaTypes(mergedSchema);
  if (types.length && !types.some((type) => matchesType(type, value))) {
    errors.push(`${path} must be ${types.join(' or ')}`);
    return;
  }

  if (mergedSchema.enum && !mergedSchema.enum.includes(value)) {
    errors.push(`${path} must be one of ${mergedSchema.enum.join(', ')}`);
    return;
  }

  if (typeof value === 'number' && typeof mergedSchema.minimum === 'number' && value < mergedSchema.minimum) {
    errors.push(`${path} must be >= ${mergedSchema.minimum}`);
    return;
  }

  if (Array.isArray(value)) {
    const itemSchema = mergedSchema.items;
    if (itemSchema) {
      value.forEach((item, index) => {
        validateAgainstSchema(itemSchema, item, `${path}[${index}]`, errors);
      });
    }
    return;
  }

  if (isPlainObject(value)) {
    const props = mergedSchema.properties ?? {};
    const required = mergedSchema.required ?? [];

    required.forEach((key) => {
      if (!(key in value)) {
        errors.push(`${path}.${key} is required`);
      }
    });

    Object.entries(value).forEach(([key, childValue]) => {
      if (key in props) {
        validateAgainstSchema(props[key]!, childValue, `${path}.${key}`, errors);
      } else if (mergedSchema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`);
      }
    });
    return;
  }
}

function mergeSchema(schema: JsonSchema): JsonSchema {
  if (!schema.$ref) return schema;
  const resolved = mergeSchema(resolveRef(schema.$ref));
  const { $ref, ...rest } = schema;
  return { ...resolved, ...rest };
}

function resolveRef(ref: string): JsonSchema {
  if (!ref.startsWith('#/$defs/')) {
    throw new Error(`Unsupported $ref: ${ref}`);
  }
  const key = ref.slice('#/$defs/'.length);
  const target = schemaDefinitions[key];
  if (!target) {
    throw new Error(`Missing schema definition for ${key}`);
  }
  return target;
}

function getSchemaTypes(schema: JsonSchema): string[] {
  if (!schema.type) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGraph(value: unknown): value is Graph {
  if (!isPlainObject(value)) return false;
  const maybe = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(maybe.nodes) && Array.isArray(maybe.edges);
}
