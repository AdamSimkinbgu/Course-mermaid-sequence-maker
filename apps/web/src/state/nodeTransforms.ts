import type { CourseNodeData, CourseStatus } from './types';

export function formatCourseLabel(courseId: string, title: string): string {
  return `${courseId}\n${title}`;
}

export function normalizeNodeUpdates(updates: Partial<CourseNodeData>): Partial<CourseNodeData> {
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

export function updateCourseNodeData(
  existing: CourseNodeData,
  normalizedUpdates: Partial<CourseNodeData>,
): CourseNodeData {
  const merged: CourseNodeData = {
    ...existing,
    ...normalizedUpdates,
  };

  if (normalizedUpdates.grade !== undefined) {
    const gradeStatus = deriveStatusFromGrade(merged.grade);
    if (gradeStatus && !merged.disabled) {
      merged.status = gradeStatus;
    } else if (!gradeStatus && !merged.disabled && merged.status === 'failed') {
      merged.status = 'planned';
    }
  }

  if (normalizedUpdates.disabled !== undefined && !merged.disabled && merged.grade) {
    const gradeStatus = deriveStatusFromGrade(merged.grade);
    if (gradeStatus) {
      merged.status = gradeStatus;
    }
  }

  merged.label = formatCourseLabel(merged.courseId, merged.title);
  return merged;
}

export function deriveStatusFromGrade(grade?: string): CourseStatus | null {
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
