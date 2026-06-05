export const InstitutionType = Object.freeze({
  SCHOOL: 'SCHOOL',
  COLLEGE: 'COLLEGE',
});

const SCHOOL_ALIASES = new Set(['school', 'schools', 'k12', 'k-12', 'secondary']);
const COLLEGE_ALIASES = new Set(['college', 'university', 'higher_education', 'higher-education']);

const normalizeString = (value) => String(value || '').trim().toLowerCase();

export const normalizeInstitutionType = (instituteData = {}) => {
  const rawType = normalizeString(
    instituteData.institutionType ||
    instituteData.type ||
    instituteData.category ||
    InstitutionType.SCHOOL
  );

  if (rawType === InstitutionType.COLLEGE || COLLEGE_ALIASES.has(rawType)) {
    return InstitutionType.COLLEGE;
  }

  if (rawType === InstitutionType.SCHOOL || SCHOOL_ALIASES.has(rawType)) {
    return InstitutionType.SCHOOL;
  }

  return rawType.includes('college') || rawType.includes('university')
    ? InstitutionType.COLLEGE
    : InstitutionType.SCHOOL;
};

export const getInstitutionProfile = (userData = {}) => {
  const instituteData = userData.instituteData || {};
  const institutionType = normalizeInstitutionType(instituteData);
  const isCollege = institutionType === InstitutionType.COLLEGE;
  const primaryValue = isCollege
    ? (userData.dept || userData.department || userData.assignedDept || userData.assignedDepartment)
    : (userData.class || userData.standard || userData.assignedClass);
  const secondaryValue = isCollege
    ? (userData.sem || userData.semester || userData.assignedSem || userData.assignedSemester)
    : (userData.section || userData.assignedSection);

  return {
    institutionType,
    isSchool: !isCollege,
    isCollege,
    instituteId: userData.instituteId || instituteData.instituteId || null,
    instituteName: instituteData.name || 'Campus',
    academicRootLabel: isCollege ? 'Department' : 'Class',
    academicChildLabel: isCollege ? 'Semester' : 'Section',
    attendanceLabel: isCollege ? 'Course attendance' : 'Daily attendance',
    gradingLabel: isCollege ? 'GPA / CGPA' : 'Continuous evaluation',
    facultyLabel: isCollege ? 'Professors' : 'Teachers',
    courseLabel: isCollege ? 'Courses' : 'Lessons',
    primaryValue: primaryValue || '',
    secondaryValue: secondaryValue || '',
    scopeSummary: isCollege
      ? `${primaryValue || 'Department'} - Sem ${secondaryValue || 'N/A'}`
      : `Class ${primaryValue || 'N/A'} - Sec ${secondaryValue || 'N/A'}`,
  };
};

export const courseMatchesLearnerScope = (course = {}, profile = {}) => {
  if (!course || !profile?.instituteId) return false;
  if (course.instituteId !== profile.instituteId) return false;

  const courseType = normalizeInstitutionType(course);
  if (courseType !== profile.institutionType) return false;

  if (profile.isCollege) {
    const departments = course.departments || course.depts || [];
    const semesters = course.semesters || course.sems || [];
    const departmentMatch = departments.length === 0 || departments.includes(profile.primaryValue);
    const semesterMatch = semesters.length === 0 || semesters.map(String).includes(String(profile.secondaryValue));
    return departmentMatch && semesterMatch;
  }

  const classes = course.classes || course.standards || [];
  const sections = course.sections || [];
  const classMatch = classes.length === 0 || classes.map(String).includes(String(profile.primaryValue));
  const sectionMatch = sections.length === 0 || sections.map(String).includes(String(profile.secondaryValue));
  return classMatch && sectionMatch;
};
