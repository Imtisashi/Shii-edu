const normalize = (value) => String(value || '').trim();
const normalizeKey = (value) => normalize(value).toLowerCase();

export const getAttendanceAssignment = (userData = {}, isSchool = true) => {
  const primary = normalize(isSchool ? userData.assignedClass : userData.assignedDept);
  const secondary = normalize(isSchool ? userData.assignedSection : userData.assignedSem);
  const assigned = userData.isClassTeacher === true && Boolean(primary && secondary);

  return {
    assigned,
    message: assigned
      ? ''
      : `Admin must assign this teacher as in-charge for one ${isSchool ? 'class and section' : 'department and semester'} before attendance can be marked.`,
    primary,
    secondary,
  };
};

export const filterStudentsForAttendanceAssignment = (students = [], assignment = {}, isSchool = true) => {
  if (!assignment.assigned) return [];

  return students.filter((student = {}) => {
    const primary = isSchool ? (student.class || student.standard) : (student.dept || student.department);
    const secondary = isSchool ? student.section : (student.sem || student.semester);

    return normalizeKey(primary) === normalizeKey(assignment.primary) &&
      normalizeKey(secondary) === normalizeKey(assignment.secondary);
  });
};
