import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import type {
  CgpaResult,
  ClassTeacherAssignment,
  CollegeCourseCredit,
  CollegeDepartment,
  CollegeSemester,
  DailyAttendanceEntry,
  DailyAttendanceStatus,
  ElectiveRegistration,
  ElectiveWindow,
  GradePointInput,
  InstitutionAcademicModel,
  InstitutionType,
  SchoolAcademicYear,
  SchoolClassSection,
  SchoolDailyAttendanceRecord,
  SchoolStandard,
  SemesterGpaResult,
} from '../types/institutionModels';

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };
type CreateAudit = { actorUid?: string | null };

const SCHOOL_STATUSES: DailyAttendanceStatus[] = ['present', 'absent', 'late', 'excused', 'not_marked'];

const slug = (value: string) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const required = (value: string, label: string) => {
  const cleaned = String(value || '').trim();
  if (!cleaned) throw new Error(`${label} is required.`);
  return cleaned;
};

const positiveNumber = (value: number, label: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`${label} must be greater than zero.`);
  return numeric;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toPayload = <T extends Record<string, unknown>>(data: T, audit: CreateAudit = {}) => ({
  ...data,
  updatedAt: serverTimestamp(),
  updatedBy: audit.actorUid || null,
});

const createPayload = <T extends Record<string, unknown>>(data: T, audit: CreateAudit = {}) => ({
  ...toPayload(data, audit),
  createdAt: serverTimestamp(),
  createdBy: audit.actorUid || null,
});

const listByInstitute = async <T>(collectionName: string, instituteId: string): Promise<T[]> => {
  const snapshot = await getDocs(query(collection(db, collectionName), where('instituteId', '==', instituteId)));
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  } as T));
};

export const buildDefaultAcademicModel = (institutionType: InstitutionType): InstitutionAcademicModel => {
  if (institutionType === 'COLLEGE') {
    return {
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
    };
  }

  return {
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
      statuses: SCHOOL_STATUSES,
    },
  };
};

export const saveDepartment = async (
  department: WithOptionalId<CollegeDepartment>,
  audit: CreateAudit = {}
) => {
  const code = required(department.code, 'Department code').toUpperCase();
  const id = department.id || `${department.instituteId}_${slug(code)}`;
  const payload = createPayload({
    ...department,
    id,
    code,
    name: required(department.name, 'Department name'),
    institutionType: 'COLLEGE' as const,
    status: department.status || 'active',
  }, audit);

  await setDoc(doc(db, 'departments', id), payload, { merge: true });
  return { ...payload, id } as CollegeDepartment;
};

export const listDepartments = (instituteId: string) => listByInstitute<CollegeDepartment>('departments', instituteId);

export const deleteDepartment = async (departmentId: string) => {
  await deleteDoc(doc(db, 'departments', departmentId));
};

export const saveSemester = async (
  semester: WithOptionalId<CollegeSemester>,
  audit: CreateAudit = {}
) => {
  const departmentId = required(semester.departmentId, 'Department id');
  const semesterNumber = positiveNumber(semester.semesterNumber, 'Semester number');
  const id = semester.id || `${semester.instituteId}_${departmentId}_sem-${semesterNumber}`;
  const payload = createPayload({
    ...semester,
    id,
    departmentId,
    semesterNumber,
    label: semester.label || `Semester ${semesterNumber}`,
    startsOn: required(semester.startsOn, 'Semester start date'),
    endsOn: required(semester.endsOn, 'Semester end date'),
    institutionType: 'COLLEGE' as const,
    status: semester.status || 'active',
  }, audit);

  await setDoc(doc(db, 'semesters', id), payload, { merge: true });
  return { ...payload, id } as CollegeSemester;
};

export const listSemesters = (instituteId: string) => listByInstitute<CollegeSemester>('semesters', instituteId);

export const saveCourseCredit = async (
  credit: WithOptionalId<CollegeCourseCredit>,
  audit: CreateAudit = {}
) => {
  const courseId = required(credit.courseId, 'Course id');
  const id = credit.id || `${credit.instituteId}_${courseId}`;
  const payload = createPayload({
    ...credit,
    id,
    courseId,
    departmentId: required(credit.departmentId, 'Department id'),
    semesterId: required(credit.semesterId, 'Semester id'),
    courseCode: required(credit.courseCode, 'Course code').toUpperCase(),
    title: required(credit.title, 'Course title'),
    creditHours: positiveNumber(credit.creditHours, 'Credit hours'),
    electiveGroupId: credit.electiveGroupId || null,
    isElective: Boolean(credit.isElective),
    institutionType: 'COLLEGE' as const,
    status: credit.status || 'active',
  }, audit);

  await setDoc(doc(db, 'courseCreditHours', id), payload, { merge: true });
  return { ...payload, id } as CollegeCourseCredit;
};

export const listCourseCredits = (instituteId: string) => listByInstitute<CollegeCourseCredit>('courseCreditHours', instituteId);

export const saveElectiveWindow = async (
  instituteId: string,
  window: ElectiveWindow,
  audit: CreateAudit = {}
) => {
  const instituteRef = doc(db, 'institutes', instituteId);
  const modelPatch = {
    academicModel: {
      electiveRegistration: {
        activeWindowId: window.status === 'active' ? window.id : null,
      },
    },
  };

  await updateDoc(instituteRef, toPayload(modelPatch, audit));
  return window;
};

export const registerElective = async (
  registration: WithOptionalId<ElectiveRegistration>,
  audit: CreateAudit = {}
) => {
  const id = registration.id ||
    `${registration.instituteId}_${registration.studentUid}_${registration.electiveGroupId}_${registration.courseId}`;
  const payload = createPayload({
    ...registration,
    id,
    studentUid: required(registration.studentUid, 'Student uid'),
    departmentId: required(registration.departmentId, 'Department id'),
    semesterId: required(registration.semesterId, 'Semester id'),
    electiveGroupId: required(registration.electiveGroupId, 'Elective group id'),
    courseId: required(registration.courseId, 'Course id'),
    courseCode: registration.courseCode || '',
    windowId: registration.windowId || null,
    status: registration.status || 'registered',
    registeredAt: serverTimestamp(),
    institutionType: 'COLLEGE' as const,
  }, audit);

  await setDoc(doc(db, 'electiveRegistrations', id), payload, { merge: true });
  return { ...payload, id } as ElectiveRegistration;
};

export const calculateSemesterGpa = (grades: GradePointInput[], scale = 10): SemesterGpaResult => {
  const validGrades = grades.filter((grade) =>
    grade.includeInGpa !== false &&
    !grade.isWithdrawn &&
    Number(grade.creditHours) > 0
  );

  const attemptedCredits = validGrades.reduce((total, grade) => total + positiveNumber(grade.creditHours, 'Credit hours'), 0);
  const weightedGradePoints = validGrades.reduce((total, grade) => {
    const creditHours = positiveNumber(grade.creditHours, 'Credit hours');
    const gradePoint = clamp(Number(grade.gradePoint) || 0, 0, scale);
    return total + gradePoint * creditHours;
  }, 0);
  const gpa = attemptedCredits === 0 ? 0 : round2(weightedGradePoints / attemptedCredits);

  return {
    attemptedCredits,
    earnedCredits: attemptedCredits,
    weightedGradePoints: round2(weightedGradePoints),
    gpa,
    scale,
  };
};

export const calculateCgpa = (semesters: SemesterGpaResult[], scale = 10): CgpaResult => {
  const attemptedCredits = semesters.reduce((total, semester) => total + Math.max(0, Number(semester.attemptedCredits) || 0), 0);
  const weightedGradePoints = semesters.reduce((total, semester) => {
    const credits = Math.max(0, Number(semester.attemptedCredits) || 0);
    const gpa = clamp(Number(semester.gpa) || 0, 0, scale);
    return total + gpa * credits;
  }, 0);

  return {
    attemptedCredits,
    weightedGradePoints: round2(weightedGradePoints),
    cgpa: attemptedCredits === 0 ? 0 : round2(weightedGradePoints / attemptedCredits),
    scale,
  };
};

export const saveAcademicYear = async (
  academicYear: WithOptionalId<SchoolAcademicYear>,
  audit: CreateAudit = {}
) => {
  const id = academicYear.id || `${academicYear.instituteId}_${slug(academicYear.label)}`;
  const payload = createPayload({
    ...academicYear,
    id,
    label: required(academicYear.label, 'Academic year label'),
    startsOn: required(academicYear.startsOn, 'Academic year start date'),
    endsOn: required(academicYear.endsOn, 'Academic year end date'),
    institutionType: 'SCHOOL' as const,
    status: academicYear.status || 'active',
  }, audit);

  await setDoc(doc(db, 'academicYears', id), payload, { merge: true });
  return { ...payload, id } as SchoolAcademicYear;
};

export const listAcademicYears = (instituteId: string) => listByInstitute<SchoolAcademicYear>('academicYears', instituteId);

export const saveStandard = async (
  standard: WithOptionalId<SchoolStandard>,
  audit: CreateAudit = {}
) => {
  const id = standard.id || `${standard.instituteId}_${standard.academicYearId}_${slug(standard.label)}`;
  const payload = createPayload({
    ...standard,
    id,
    academicYearId: required(standard.academicYearId, 'Academic year id'),
    label: required(standard.label, 'Standard label'),
    order: Number.isFinite(Number(standard.order)) ? Number(standard.order) : 0,
    institutionType: 'SCHOOL' as const,
    status: standard.status || 'active',
  }, audit);

  await setDoc(doc(db, 'standards', id), payload, { merge: true });
  return { ...payload, id } as SchoolStandard;
};

export const listStandards = (instituteId: string) => listByInstitute<SchoolStandard>('standards', instituteId);

export const saveClassSection = async (
  section: WithOptionalId<SchoolClassSection>,
  audit: CreateAudit = {}
) => {
  const academicYearId = required(section.academicYearId, 'Academic year id');
  const standardId = required(section.standardId, 'Standard id');
  const sectionName = required(section.sectionName, 'Section name').toUpperCase();
  const id = section.id || `${section.instituteId}_${academicYearId}_${standardId}_${slug(sectionName)}`;
  const payload = createPayload({
    ...section,
    id,
    academicYearId,
    standardId,
    standardLabel: required(section.standardLabel, 'Standard label'),
    sectionName,
    classTeacherUid: section.classTeacherUid || null,
    studentUids: Array.isArray(section.studentUids) ? section.studentUids : [],
    institutionType: 'SCHOOL' as const,
    status: section.status || 'active',
  }, audit);

  await setDoc(doc(db, 'classSections', id), payload, { merge: true });
  return { ...payload, id } as SchoolClassSection;
};

export const listClassSections = (instituteId: string) => listByInstitute<SchoolClassSection>('classSections', instituteId);

export const assignClassTeacher = async (
  assignment: WithOptionalId<ClassTeacherAssignment>,
  audit: CreateAudit = {}
) => {
  const classSectionId = required(assignment.classSectionId, 'Class section id');
  const teacherUid = required(assignment.teacherUid, 'Teacher uid');
  const id = assignment.id || `${assignment.instituteId}_${classSectionId}`;
  const batch = writeBatch(db);
  const payload = createPayload({
    ...assignment,
    id,
    classSectionId,
    teacherUid,
    academicYearId: required(assignment.academicYearId, 'Academic year id'),
    standardId: required(assignment.standardId, 'Standard id'),
    sectionName: required(assignment.sectionName, 'Section name').toUpperCase(),
    institutionType: 'SCHOOL' as const,
    status: assignment.status || 'assigned',
  }, audit);

  batch.set(doc(db, 'classTeacherAssignments', id), payload, { merge: true });
  batch.set(doc(db, 'classSections', classSectionId), toPayload({ classTeacherUid: teacherUid }, audit), { merge: true });
  await batch.commit();

  return { ...payload, id } as ClassTeacherAssignment;
};

export const summarizeDailyAttendance = (entries: DailyAttendanceEntry[]) => entries.reduce(
  (summary, entry) => {
    const status = SCHOOL_STATUSES.includes(entry.status) ? entry.status : 'not_marked';
    return {
      ...summary,
      total: summary.total + 1,
      present: summary.present + (status === 'present' ? 1 : 0),
      absent: summary.absent + (status === 'absent' ? 1 : 0),
      late: summary.late + (status === 'late' ? 1 : 0),
      excused: summary.excused + (status === 'excused' ? 1 : 0),
      notMarked: summary.notMarked + (status === 'not_marked' ? 1 : 0),
    };
  },
  { total: 0, present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 }
);

export const buildDailyAttendanceRecord = (
  record: Omit<SchoolDailyAttendanceRecord, 'id' | 'summary' | 'institutionType'> & { id?: string }
): SchoolDailyAttendanceRecord => {
  const date = required(record.date, 'Attendance date');
  const id = record.id || `${record.instituteId}_${record.academicYearId}_${record.classSectionId}_${date}`;
  const entries = record.entries.map((entry) => ({
    ...entry,
    status: SCHOOL_STATUSES.includes(entry.status) ? entry.status : 'not_marked',
  }));

  return {
    ...record,
    id,
    date,
    entries,
    summary: summarizeDailyAttendance(entries),
    institutionType: 'SCHOOL',
  };
};

export const saveDailyAttendanceRecord = async (
  record: SchoolDailyAttendanceRecord,
  audit: CreateAudit = {}
) => {
  const payload = createPayload(record as unknown as Record<string, unknown>, audit);
  await setDoc(doc(db, 'dailyAttendance', record.id), payload, { merge: true });
  return { ...record, ...payload } as SchoolDailyAttendanceRecord;
};
