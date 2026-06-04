import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { getInstitutionProfile, InstitutionType } from '../services/institutionalProfile';
import { db } from '../../firebaseConfig';

const InstitutionContext = createContext(null);
const SUPERADMIN_ROLE = 'superadmin';

const arrayFromConfig = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'object') return Object.values(value).filter(Boolean);
  return [];
};

const normalizeSection = (section) => {
  if (typeof section === 'string' || typeof section === 'number') {
    return { id: String(section), label: String(section) };
  }

  return {
    id: String(section?.id || section?.name || section?.label || ''),
    label: String(section?.label || section?.name || section?.id || ''),
    classTeacherUid: section?.classTeacherUid || section?.teacherUid || null,
  };
};

const buildSchoolWorkflow = (instituteData = {}) => {
  const academicModel = instituteData.academicModel || {};
  const academicYears = arrayFromConfig(academicModel.academicYears || instituteData.academicYears || instituteData.years)
    .map((year) => (typeof year === 'string' ? { id: year, label: year } : year));
  const gradeSource = academicModel.classSections || instituteData.classSections || instituteData.gradeSections || instituteData.classes || [];
  const gradeBlocks = arrayFromConfig(gradeSource).map((grade) => {
    if (typeof grade === 'string' || typeof grade === 'number') {
      return {
        id: String(grade),
        label: `Class ${grade}`,
        sections: [],
      };
    }

    return {
      id: String(grade.id || grade.class || grade.grade || grade.name || ''),
      label: String(grade.label || grade.name || grade.class || grade.grade || 'Class'),
      sections: arrayFromConfig(grade.sections || grade.sectionList).map(normalizeSection),
    };
  });

  return {
    mode: InstitutionType.SCHOOL,
    modelVersion: academicModel.modelVersion || 1,
    system: academicModel.system || 'academic-year',
    academicYears,
    gradeBlocks,
    standards: arrayFromConfig(academicModel.standards || instituteData.standards),
    classTeacherAssignments: academicModel.classTeacherAssignments || instituteData.classTeacherAssignments || {},
    attendancePolicy: {
      requiredDaily: true,
      allowSubjectAttendance: false,
      parentVisible: true,
      ...(academicModel.attendance || {}),
    },
    grading: {
      label: 'Continuous Evaluation',
      matrices: arrayFromConfig(instituteData.evaluationMatrices || instituteData.gradingMatrices),
    },
    parentDashboardsEnabled: true,
  };
};

const buildCollegeWorkflow = (instituteData = {}) => {
  const academicModel = instituteData.academicModel || {};
  const departments = arrayFromConfig(academicModel.departments || instituteData.departments || instituteData.depts)
    .map((department) => (typeof department === 'string'
      ? { id: department, label: department, courses: [] }
      : {
        id: String(department.id || department.code || department.name || ''),
        label: String(department.label || department.name || department.code || 'Department'),
        courses: arrayFromConfig(department.courses),
      }));
  const semesters = arrayFromConfig(academicModel.semesters || instituteData.semesters || instituteData.sems)
    .map((semester) => (typeof semester === 'string' || typeof semester === 'number'
      ? { id: String(semester), label: `Semester ${semester}` }
      : semester));

  return {
    mode: InstitutionType.COLLEGE,
    modelVersion: academicModel.modelVersion || 1,
    system: academicModel.system || 'semester',
    departments,
    semesters,
    creditHours: academicModel.creditHours || instituteData.creditHours || {},
    electiveRegistration: academicModel.electiveRegistration || {
      enabled: instituteData.electiveRegistrationEnabled !== false,
      activeWindowId: null,
      windows: [],
      window: instituteData.electiveRegistrationWindow || null,
    },
    professorCoursePairings: instituteData.professorCoursePairings || {},
    gpa: academicModel.gpa || {
      scale: Number(instituteData.gpaScale || 10),
      cgpaEnabled: true,
      formula: instituteData.gpaFormula || 'weighted-credit-average',
    },
    attendancePolicy: {
      requiredDaily: false,
      allowSubjectAttendance: true,
      parentVisible: false,
    },
  };
};

export function InstitutionProvider({ children }) {
  const { userData } = useAuth();
  const normalizedRole = String(userData?.role || '').trim().toLowerCase();
  const isSuperAdmin = normalizedRole === SUPERADMIN_ROLE;
  const [firestoreInstituteData, setFirestoreInstituteData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isSuperAdmin) {
      setFirestoreInstituteData(null);
      setStatus('platform');
      setError(null);
      return undefined;
    }

    const instituteId = userData?.instituteId;

    if (!instituteId) {
      setFirestoreInstituteData(null);
      setStatus('idle');
      setError(null);
      return undefined;
    }

    setStatus('loading');
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'institutes', instituteId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setFirestoreInstituteData(null);
          setStatus('missing');
          return;
        }

        const data = snapshot.data();
        setFirestoreInstituteData({
          id: snapshot.id,
          ...data,
          instituteId: data.instituteId || snapshot.id,
        });
        setStatus('ready');
      },
      (snapshotError) => {
        console.error('Failed to read institution mode from Firestore:', snapshotError);
        setFirestoreInstituteData(null);
        setError(snapshotError.message || 'Unable to read institution mode.');
        setStatus('error');
      }
    );

    return unsubscribe;
  }, [isSuperAdmin, userData?.instituteId]);

  const value = useMemo(() => {
    if (isSuperAdmin) {
      return {
        profile: {
          institutionType: 'PLATFORM',
          isSchool: false,
          isCollege: false,
          isPlatform: true,
          instituteId: null,
          instituteName: 'Edu-Hub Platform',
          academicRootLabel: 'Institutes',
          academicChildLabel: 'Institutes',
          attendanceLabel: 'Platform attendance disabled',
          gradingLabel: 'Platform grading disabled',
          facultyLabel: 'Institute admins',
          courseLabel: 'Institute systems',
          primaryValue: '',
          secondaryValue: '',
          scopeSummary: 'Superadmin platform control',
        },
        workflow: {
          mode: 'PLATFORM',
          instituteCreationEnabled: true,
          supportedInstitutionTypes: [InstitutionType.SCHOOL, InstitutionType.COLLEGE],
        },
        institutionType: 'PLATFORM',
        modeLabel: 'PLATFORM',
        isSchool: false,
        isCollege: false,
        isPlatform: true,
        instituteData: null,
        status: 'platform',
        error: null,
        source: 'superadmin-role',
        labels: {
          academicRoot: 'Institutes',
          academicChild: 'Institutes',
          attendance: 'Platform attendance disabled',
          grading: 'Platform grading disabled',
          faculty: 'Institute admins',
          course: 'Institute systems',
        },
      };
    }

    const instituteData = firestoreInstituteData || userData?.instituteData || {};
    const profile = getInstitutionProfile({
      ...(userData || {}),
      instituteData,
    });
    const workflow = profile.institutionType === InstitutionType.COLLEGE
      ? buildCollegeWorkflow(instituteData)
      : buildSchoolWorkflow(instituteData);

    return {
      profile,
      workflow,
      institutionType: profile.institutionType,
      modeLabel: profile.institutionType,
      isSchool: profile.isSchool,
      isCollege: profile.isCollege,
      isPlatform: false,
      instituteData,
      status,
      error,
      source: firestoreInstituteData ? 'firestore' : 'auth-profile',
      labels: {
        academicRoot: profile.academicRootLabel,
        academicChild: profile.academicChildLabel,
        attendance: profile.attendanceLabel,
        grading: profile.gradingLabel,
        faculty: profile.facultyLabel,
        course: profile.courseLabel
      }
    };
  }, [error, firestoreInstituteData, isSuperAdmin, status, userData]);

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (!context) {
    throw new Error('useInstitution must be used inside InstitutionProvider.');
  }

  return context;
}
