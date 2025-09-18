import type { Graph } from '@course-dag/core';

export function loadSampleGraph(): Graph {
  return {
    id: 'graph-sample',
    nodes: [
      {
        id: 'CS101',
        nodeType: 'course',
        title: 'Introduction to Computer Science',
        credits: 3,
        department: 'CS',
        level: '100',
        term: 'Fall',
      },
      {
        id: 'CS102',
        nodeType: 'course',
        title: 'Programming Fundamentals',
        credits: 3,
        department: 'CS',
        level: '100',
        term: 'Spring',
      },
      {
        id: 'CS201',
        nodeType: 'course',
        title: 'Data Structures',
        credits: 4,
        department: 'CS',
        level: '200',
        term: 'Fall',
      },
      {
        id: 'CS202',
        nodeType: 'course',
        title: 'Algorithms',
        credits: 4,
        department: 'CS',
        level: '200',
        term: 'Spring',
      },
      {
        id: 'CS204',
        nodeType: 'course',
        title: 'Linear Algebra for Computing',
        credits: 3,
        department: 'MATH',
        level: '200',
        term: 'Spring',
      },
      {
        id: 'CS310',
        nodeType: 'course',
        title: 'Machine Learning',
        credits: 3,
        department: 'CS',
        level: '300',
        term: 'Fall',
      },
    ],
    edges: [
      { id: 'e1', source: 'CS101', target: 'CS102' },
      { id: 'e2', source: 'CS102', target: 'CS201' },
      { id: 'e3', source: 'CS201', target: 'CS202' },
      { id: 'e4', source: 'CS202', target: 'CS310', groupingId: 'CS310::g1' },
      { id: 'e5', source: 'CS201', target: 'CS310', groupingId: 'CS310::g1' },
      { id: 'e6', source: 'CS204', target: 'CS310', groupingId: 'CS310::g2' },
    ],
    prereqExpressions: [
      { courseId: 'CS101', expression: 'NONE' },
      { courseId: 'CS102', expression: 'CS101' },
      { courseId: 'CS201', expression: 'CS102' },
      { courseId: 'CS202', expression: 'CS201' },
      { courseId: 'CS204', expression: 'NONE' },
      { courseId: 'CS310', expression: '(CS202 AND CS201) OR CS204' },
    ],
  };
}
