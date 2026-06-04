export type InstitutionType = 'SCHOOL' | 'COLLEGE';
export type ModelStatus = 'draft' | 'active' | 'archived';

export interface FirestoreAuditFields {
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface InstitutionScopedRecord extends FirestoreAuditFields {
  id: string;
  instituteId: string;
  institutionType: InstitutionType;
}

export type EduHubUserRole = 'student' | 'teacher' | 'admin' | 'superadmin';
export type TeacherAssignmentStatus = 'unassigned' | 'subject_teacher' | 'class_teacher' | 'batch_advisor';

export interface TeacherTeachingScope {
  classes: string[];
  sections: string[];
  departments: string[];
  semesters: string[];
}

export interface FirestoreTeacherProfile extends FirestoreAuditFields {
  uid: string;
  name: string;
  email: string;
  role: 'teacher';
  instituteId: string;
  uniqueId: string;
  teacherCode: string;
  degree?: string;
  isClassTeacher: boolean;
  assignmentStatus: TeacherAssignmentStatus;
  assignedClass?: string | null;
  assignedSection?: string | null;
  assignedDept?: string | null;
  assignedSem?: string | null;
  teachingScope: TeacherTeachingScope;
}

export interface CollegeDepartment extends InstitutionScopedRecord {
  institutionType: 'COLLEGE';
  code: string;
  name: string;
  faculty?: string;
  status: ModelStatus;
}

export interface CollegeSemester extends InstitutionScopedRecord {
  institutionType: 'COLLEGE';
  departmentId: string;
  semesterNumber: number;
  label: string;
  startsOn: string;
  endsOn: string;
  status: ModelStatus;
}

export interface CollegeCourseCredit extends InstitutionScopedRecord {
  institutionType: 'COLLEGE';
  departmentId: string;
  semesterId: string;
  courseId: string;
  courseCode: string;
  title: string;
  creditHours: number;
  electiveGroupId?: string | null;
  isElective: boolean;
  status: ModelStatus;
}

export interface ElectiveWindow {
  id: string;
  label: string;
  opensAt: string;
  closesAt: string;
  departmentIds: string[];
  semesterIds: string[];
  maxSelections: number;
  status: ModelStatus;
}

export interface ElectiveRegistration extends InstitutionScopedRecord {
  institutionType: 'COLLEGE';
  studentUid: string;
  departmentId: string;
  semesterId: string;
  electiveGroupId: string;
  courseId: string;
  courseCode?: string;
  windowId?: string | null;
  status: 'registered' | 'waitlisted' | 'dropped';
  registeredAt?: unknown;
}

export interface GradePointInput {
  courseId: string;
  creditHours: number;
  gradePoint: number;
  letterGrade?: string;
  includeInGpa?: boolean;
  isWithdrawn?: boolean;
}

export interface SemesterGpaResult {
  attemptedCredits: number;
  earnedCredits: number;
  weightedGradePoints: number;
  gpa: number;
  scale: number;
}

export interface CgpaResult {
  attemptedCredits: number;
  weightedGradePoints: number;
  cgpa: number;
  scale: number;
}

export interface CollegeAcademicModel {
  system: 'semester';
  modelVersion: 1;
  departments: CollegeDepartment[];
  semesters: CollegeSemester[];
  creditHours: Record<string, number>;
  electiveRegistration: {
    enabled: boolean;
    activeWindowId: string | null;
    windows: ElectiveWindow[];
  };
  gpa: {
    scale: number;
    formula: 'sum(gradePoints * creditHours) / sum(creditHours)';
    cgpaFormula: 'sum(semesterGpa * semesterCredits) / sum(semesterCredits)';
    rounding: 'nearest-0.01';
  };
}

export interface SchoolAcademicYear extends InstitutionScopedRecord {
  institutionType: 'SCHOOL';
  label: string;
  startsOn: string;
  endsOn: string;
  status: ModelStatus;
}

export interface SchoolStandard extends InstitutionScopedRecord {
  institutionType: 'SCHOOL';
  academicYearId: string;
  label: string;
  order: number;
  status: ModelStatus;
}

export interface SchoolClassSection extends InstitutionScopedRecord {
  institutionType: 'SCHOOL';
  academicYearId: string;
  standardId: string;
  standardLabel: string;
  sectionName: string;
  classTeacherUid: string | null;
  studentUids: string[];
  status: ModelStatus;
}

export interface ClassTeacherAssignment extends InstitutionScopedRecord {
  institutionType: 'SCHOOL';
  academicYearId: string;
  classSectionId: string;
  teacherUid: string;
  standardId: string;
  sectionName: string;
  status: 'assigned' | 'released';
}

export type DailyAttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'not_marked';

export interface DailyAttendanceEntry {
  studentUid: string;
  status: DailyAttendanceStatus;
  markedAt?: unknown;
  markedBy?: string | null;
  note?: string | null;
}

export interface DailyAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
}

export interface SchoolDailyAttendanceRecord extends InstitutionScopedRecord {
  institutionType: 'SCHOOL';
  academicYearId: string;
  classSectionId: string;
  standardId: string;
  sectionName: string;
  date: string;
  entries: DailyAttendanceEntry[];
  summary: DailyAttendanceSummary;
}

export interface SchoolAcademicModel {
  system: 'academic-year';
  modelVersion: 1;
  academicYears: SchoolAcademicYear[];
  standards: SchoolStandard[];
  classSections: SchoolClassSection[];
  classTeacherAssignments: Record<string, ClassTeacherAssignment>;
  attendance: {
    cadence: 'daily';
    requiredForEveryInstructionalDay: true;
    recordsShape: 'dailyAttendance/{instituteId}_{academicYearId}_{classSectionId}_{yyyy-mm-dd}';
    statuses: DailyAttendanceStatus[];
  };
}

export type InstitutionAcademicModel = CollegeAcademicModel | SchoolAcademicModel;
