const {
  admin,
  getAdminServices,
} = require('../_lib/firebaseAdmin');
const { sendExpoPushToUsers } = require('../_lib/expoPush');

const ATTENDANCE_THRESHOLD = 75;
const GRADE_THRESHOLD = 40;
const MAX_STUDENTS_PER_RUN = 500;
const QUERY_LIMIT = 160;

const authorizationValid = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
};

const percentageFromAttendance = (records) => {
  const marked = records.filter((record) => (
    record.status === 'present' ||
    record.status === 'absent' ||
    record.isPresent === true ||
    record.isPresent === false
  ));
  if (marked.length === 0) return null;
  const present = marked.filter((record) => record.status === 'present' || record.isPresent === true).length;
  return Math.round((present / marked.length) * 100);
};

const percentageFromGrades = (records) => {
  const percentages = records.map((grade) => {
    if (Number.isFinite(Number(grade.percentage))) return Number(grade.percentage);
    const marks = Number(grade.marks ?? grade.score ?? grade.obtainedMarks);
    const total = Number(grade.totalMarks ?? grade.maxScore);
    return total > 0 && Number.isFinite(marks) ? (marks / total) * 100 : null;
  }).filter((value) => value !== null);
  if (percentages.length === 0) return null;
  return Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length);
};

const loadStudentMetrics = async (firestore, student) => {
  const [attendanceSnapshot, gradeSnapshot] = await Promise.all([
    firestore.collection('attendance').where('studentUid', '==', student.id).limit(QUERY_LIMIT).get(),
    firestore.collection('grades').where('studentUid', '==', student.id).limit(QUERY_LIMIT).get(),
  ]);
  const attendance = attendanceSnapshot.docs.map((document) => document.data()).filter((record) => record.instituteId === student.instituteId);
  const grades = gradeSnapshot.docs.map((document) => document.data()).filter((record) => record.instituteId === student.instituteId);
  return {
    attendancePercentage: percentageFromAttendance(attendance),
    gradePercentage: percentageFromGrades(grades),
    attendanceRecordCount: attendance.length,
    gradeRecordCount: grades.length,
  };
};

const matchesStudentScope = (teacher, student) => {
  if (!teacher.isClassTeacher) return false;
  const schoolMatch = teacher.assignedClass && teacher.assignedSection &&
    String(teacher.assignedClass) === String(student.class || student.standard || '') &&
    String(teacher.assignedSection) === String(student.section || '');
  const collegeMatch = teacher.assignedDept && teacher.assignedSem &&
    String(teacher.assignedDept) === String(student.dept || student.department || '') &&
    String(teacher.assignedSem) === String(student.sem || student.semester || '');
  return schoolMatch || collegeMatch;
};

const loadInstitutePeople = async (firestore, instituteId, cache) => {
  if (cache.has(instituteId)) return cache.get(instituteId);
  const snapshot = await firestore.collection('users').where('instituteId', '==', instituteId).get();
  const users = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const people = {
    parents: users.filter((user) => user.role === 'parent'),
    teachers: users.filter((user) => user.role === 'teacher' || user.role === 'professor'),
  };
  cache.set(instituteId, people);
  return people;
};

const recipientUidsForStudent = ({ student, people }) => {
  const recipients = new Set([student.id]);
  people.parents.forEach((parent) => {
    const childUids = Array.isArray(parent.childUids) ? parent.childUids : [];
    if (parent.linkedStudentUid === student.id || childUids.includes(student.id)) recipients.add(parent.id);
  });
  people.teachers.filter((teacher) => matchesStudentScope(teacher, student)).forEach((teacher) => recipients.add(teacher.id));
  return [...recipients];
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }
  if (!authorizationValid(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized cron request.' });
    return;
  }

  try {
    const { firestore } = getAdminServices();
    const runDate = new Date().toISOString().slice(0, 10);
    const stateRef = firestore.collection('systemState').doc('proactiveWarningCursor');
    const stateSnapshot = await stateRef.get();
    const lastStudentUid = stateSnapshot.exists ? stateSnapshot.data()?.lastStudentUid : null;
    let studentQuery = firestore.collection('users')
      .where('role', '==', 'student')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(MAX_STUDENTS_PER_RUN);
    if (lastStudentUid) studentQuery = studentQuery.startAfter(lastStudentUid);
    let studentSnapshot = await studentQuery.get();
    let wrapped = false;
    if (studentSnapshot.empty && lastStudentUid) {
      wrapped = true;
      studentSnapshot = await firestore.collection('users')
        .where('role', '==', 'student')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(MAX_STUDENTS_PER_RUN)
        .get();
    }

    const students = studentSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((student) => student.instituteId);
    const institutePeopleCache = new Map();
    let warningsCreated = 0;
    let attendanceWarnings = 0;
    let gradeWarnings = 0;

    for (const student of students) {
      const metrics = await loadStudentMetrics(firestore, student);
      const warnings = [];
      if (metrics.attendancePercentage !== null && metrics.attendancePercentage < ATTENDANCE_THRESHOLD) {
        warnings.push({
          key: 'attendance',
          title: 'Attendance warning',
          message: `${student.name || 'Student'} is at ${metrics.attendancePercentage}% attendance, below the ${ATTENDANCE_THRESHOLD}% threshold.`,
          relatedType: 'attendance_warning',
        });
        attendanceWarnings += 1;
      }
      if (metrics.gradePercentage !== null && metrics.gradePercentage < GRADE_THRESHOLD) {
        warnings.push({
          key: 'grades',
          title: 'Academic progress warning',
          message: `${student.name || 'Student'} has a recent grade average of ${metrics.gradePercentage}%.`,
          relatedType: 'grade_warning',
        });
        gradeWarnings += 1;
      }
      if (warnings.length === 0) continue;

      const people = await loadInstitutePeople(firestore, student.instituteId, institutePeopleCache);
      const recipientUids = recipientUidsForStudent({ student, people });
      for (const warning of warnings) {
        const notificationRef = firestore.collection('notifications').doc(`${runDate}_${student.id}_${warning.key}`);
        const existing = await notificationRef.get();
        if (existing.exists) continue;
        await notificationRef.set({
          instituteId: student.instituteId,
          title: warning.title,
          message: warning.message,
          type: 'warning',
          targetRoles: ['student', 'parent', 'teacher'],
          recipientUids,
          relatedId: student.id,
          relatedType: warning.relatedType,
          author: 'Shii-Edu Proactive Warnings',
          data: {
            originalType: warning.relatedType,
            studentUid: student.id,
            attendancePercentage: metrics.attendancePercentage,
            gradePercentage: metrics.gradePercentage,
          },
          isRead: false,
          readBy: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        warningsCreated += 1;
        await sendExpoPushToUsers({
          firestore,
          instituteId: student.instituteId,
          recipientUids,
          title: warning.title,
          body: warning.message,
          data: { type: warning.relatedType, studentUid: student.id },
        }).catch((error) => console.warn('Proactive warning push failed:', error));
      }
    }

    const lastProcessedStudentUid = studentSnapshot.docs.at(-1)?.id || null;
    await stateRef.set({
      lastStudentUid: lastProcessedStudentUid,
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunDate: runDate,
      processedStudents: students.length,
      warningsCreated,
      wrapped,
    }, { merge: true });

    res.status(200).json({
      success: true,
      runDate,
      processedStudents: students.length,
      warningsCreated,
      attendanceWarnings,
      gradeWarnings,
      wrapped,
    });
  } catch (error) {
    console.error('Proactive warning cron failed:', error);
    res.status(500).json({ success: false, error: 'Proactive warning scan failed.' });
  }
};
