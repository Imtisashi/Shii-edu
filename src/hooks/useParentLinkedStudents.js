import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const normalize = (value) => String(value || '').trim();
const normalizeKey = (value) => normalize(value).toLowerCase();
const getDb = () => require('../../firebaseConfig').db;

const mergeReference = (references, next = {}) => {
  const uid = normalize(next.uid || next.studentUid || next.id);
  const userId = normalize(next.userId || next.studentId || next.loginId || next.uniqueId);
  const name = normalize(next.name || next.studentName);
  if (!uid && !userId) return references;

  const existingIndex = references.findIndex((reference) => (
    (uid && reference.uid === uid) ||
    (userId && normalizeKey(reference.userId) === normalizeKey(userId))
  ));

  if (existingIndex >= 0) {
    const existing = references[existingIndex];
    references[existingIndex] = {
      uid: existing.uid || uid,
      userId: existing.userId || userId,
      name: existing.name || name,
    };
    return references;
  }

  references.push({ uid, userId, name });
  return references;
};

export const getParentChildReferences = (userData = {}) => {
  const references = [];

  mergeReference(references, {
    uid: userData.linkedStudentUid,
    userId: userData.linkedStudentUserId || userData.studentId,
    name: userData.linkedStudentName,
  });

  (Array.isArray(userData.childUids) ? userData.childUids : []).forEach((uid) => {
    mergeReference(references, { uid });
  });

  (Array.isArray(userData.linkedStudents) ? userData.linkedStudents : []).forEach((student) => {
    mergeReference(references, student);
  });

  return references;
};

export const studentMatchesParentReference = (student = {}, reference = {}) => {
  const uid = normalize(reference.uid);
  const userIdKey = normalizeKey(reference.userId);

  if (uid && [student.id, student.uid, student.authUid].some((value) => normalize(value) === uid)) {
    return true;
  }

  if (!userIdKey) return false;

  return [
    student.loginId,
    student.uniqueId,
    student.studentId,
    student.userId,
    student.loginIdKey,
    student.id,
  ].some((value) => normalizeKey(value) === userIdKey);
};

export function useParentLinkedStudents(userData) {
  const references = useMemo(() => getParentChildReferences(userData), [userData]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.instituteId || references.length === 0) {
      setStudents([]);
      setSelectedStudentId('');
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const studentsQuery = query(
      collection(getDb(), 'users'),
      where('instituteId', '==', userData.instituteId),
      where('role', '==', 'student')
    );

    return onSnapshot(studentsQuery, (snapshot) => {
      const nextStudents = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((student) => references.some((reference) => studentMatchesParentReference(student, reference)))
        .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));

      setStudents(nextStudents);
      setSelectedStudentId((current) => {
        if (current && nextStudents.some((student) => student.id === current)) return current;
        return nextStudents[0]?.id || '';
      });
      setLoading(false);
    }, (error) => {
      console.warn('Parent linked students listener failed:', error);
      setStudents([]);
      setSelectedStudentId('');
      setLoading(false);
    });
  }, [references, userData?.instituteId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || students[0] || null,
    [selectedStudentId, students]
  );

  return {
    childReferences: references,
    loading,
    selectedStudent,
    selectedStudentId,
    setSelectedStudentId,
    students,
  };
}
