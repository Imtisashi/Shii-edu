const SCHOOL_ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused', 'not_marked'];

const buildCollegeAcademicModel = () => ({
  system: 'semester',
  modelVersion: 1,
  departments: [],
  semesters: [],
  creditHours: {},
  electiveRegistration: {
    enabled: true,
    activeWindowId: null,
    windows: [],
  },
  gpa: {
    scale: 10,
    formula: 'sum(gradePoints * creditHours) / sum(creditHours)',
    cgpaFormula: 'sum(semesterGpa * semesterCredits) / sum(semesterCredits)',
    rounding: 'nearest-0.01',
  },
});

const buildSchoolAcademicModel = () => ({
  system: 'academic-year',
  modelVersion: 1,
  academicYears: [],
  standards: [],
  classSections: [],
  classTeacherAssignments: {},
  attendance: {
    cadence: 'daily',
    requiredForEveryInstructionalDay: true,
    recordsShape: 'dailyAttendance/{instituteId}_{academicYearId}_{classSectionId}_{yyyy-mm-dd}',
    statuses: SCHOOL_ATTENDANCE_STATUSES,
  },
});

const buildDefaultAcademicModel = (institutionType) => (
  institutionType === 'COLLEGE'
    ? buildCollegeAcademicModel()
    : buildSchoolAcademicModel()
);

module.exports = {
  SCHOOL_ATTENDANCE_STATUSES,
  buildCollegeAcademicModel,
  buildDefaultAcademicModel,
  buildSchoolAcademicModel,
};
