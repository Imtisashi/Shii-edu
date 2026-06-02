import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getInstitutionProfile, InstitutionType } from '../services/institutionalProfile';

const InstitutionContext = createContext(null);

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
  const academicYears = arrayFromConfig(instituteData.academicYears || instituteData.years)
    .map((year) => (typeof year === 'string' ? { id: year, label: year } : year));
  const gradeSource = instituteData.classSections || instituteData.gradeSections || instituteData.classes || [];
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
    academicYears,
    gradeBlocks,
    classTeacherAssignments: instituteData.classTeacherAssignments || {},
    attendancePolicy: {
      requiredDaily: true,
      allowSubjectAttendance: false,
      parentVisible: true,
    },
    grading: {
      label: 'Continuous Evaluation',
      matrices: arrayFromConfig(instituteData.evaluationMatrices || instituteData.gradingMatrices),
    },
    parentDashboardsEnabled: true,
  };
};

const buildCollegeWorkflow = (instituteData = {}) => {
  const departments = arrayFromConfig(instituteData.departments || instituteData.depts)
    .map((department) => (typeof department === 'string'
      ? { id: department, label: department, courses: [] }
      : {
        id: String(department.id || department.code || department.name || ''),
        label: String(department.label || department.name || department.code || 'Department'),
        courses: arrayFromConfig(department.courses),
      }));
  const semesters = arrayFromConfig(instituteData.semesters || instituteData.sems)
    .map((semester) => (typeof semester === 'string' || typeof semester === 'number'
      ? { id: String(semester), label: `Semester ${semester}` }
      : semester));

  return {
    mode: InstitutionType.COLLEGE,
    departments,
    semesters,
    creditHours: instituteData.creditHours || {},
    electiveRegistration: {
      enabled: instituteData.electiveRegistrationEnabled !== false,
      window: instituteData.electiveRegistrationWindow || null,
    },
    professorCoursePairings: instituteData.professorCoursePairings || {},
    gpa: {
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

  const value = useMemo(() => {
    const profile = getInstitutionProfile(userData || {});
    const instituteData = userData?.instituteData || {};
    const workflow = profile.institutionType === InstitutionType.COLLEGE
      ? buildCollegeWorkflow(instituteData)
      : buildSchoolWorkflow(instituteData);

    return {
      profile,
      workflow,
      institutionType: profile.institutionType,
      isSchool: profile.isSchool,
      isCollege: profile.isCollege,
      labels: {
        academicRoot: profile.academicRootLabel,
        academicChild: profile.academicChildLabel,
        attendance: profile.attendanceLabel,
        grading: profile.gradingLabel,
        faculty: profile.facultyLabel,
        course: profile.courseLabel
      }
    };
  }, [userData]);

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