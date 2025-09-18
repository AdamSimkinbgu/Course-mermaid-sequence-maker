import type { NodeProps } from 'reactflow';

import type { CourseNodeData } from '../../state/GraphContext';

import './CourseNode.css';

function statusLabel(status: CourseNodeData['status'], disabled: boolean): string {
  if (disabled) return 'Excluded from plan';
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In progress';
    case 'failed':
      return 'Failed';
    case 'planned':
      return 'Planned';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

export function CourseNode({ data, selected }: NodeProps<CourseNodeData>): JSX.Element {
  return (
    <div className="course-node__container">
      <div className="course-node__header">
        <span className="course-node__code">{data.courseId}</span>
        <div className="course-node__badges">
          {data.grade && (
            <span className="course-node__badge course-node__badge--grade" title="Grade">
              {data.grade}
            </span>
          )}
          <span
            className="course-node__badge course-node__badge--status"
            title={statusLabel(data.status, data.disabled)}
          >
            {data.disabled ? 'Excluded' : data.status.replace('_', ' ')}
          </span>
        </div>
      </div>
      <div className="course-node__title" title={data.title}>
        {data.title}
      </div>
      <div className="course-node__meta">
        <span>{data.credits} credits</span>
        {data.department && <span>{data.department}</span>}
        {data.level && <span>Level {data.level}</span>}
        {data.term && <span>{data.term}</span>}
      </div>
      {data.notes && !selected && (
        <div className="course-node__notes" title={data.notes}>
          {data.notes}
        </div>
      )}
    </div>
  );
}
