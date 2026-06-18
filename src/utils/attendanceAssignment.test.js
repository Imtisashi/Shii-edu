import {
  getAttendanceAssignment,
  filterStudentsForAttendanceAssignment,
} from './attendanceAssignment';

describe('attendance assignment enforcement', () => {
  it('blocks attendance until admin assigns an in-charge class and section', () => {
    expect(getAttendanceAssignment({ role: 'teacher' }, true)).toEqual({
      assigned: false,
      message: 'Admin must assign this teacher as in-charge for one class and section before attendance can be marked.',
      primary: '',
      secondary: '',
    });
  });

  it('filters school attendance to the assigned class and section only', () => {
    const assignment = getAttendanceAssignment({
      assignedClass: '10',
      assignedSection: 'A',
      isClassTeacher: true,
    }, true);
    const students = [
      { id: 's1', class: '10', section: 'A' },
      { id: 's2', standard: '10', section: 'B' },
      { id: 's3', class: '9', section: 'A' },
    ];

    expect(filterStudentsForAttendanceAssignment(students, assignment, true).map((student) => student.id)).toEqual(['s1']);
  });
});
