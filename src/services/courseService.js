import { doc, onSnapshot, query, collection, where, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { courseMatchesLearnerScope, getInstitutionProfile, normalizeInstitutionType } from './institutionalProfile';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeLesson = (lesson, lessonIndex) => ({
  id: String(lesson.id || lesson.lessonId || `lesson-${lessonIndex + 1}`),
  title: lesson.title || `Lesson ${lessonIndex + 1}`,
  description: lesson.description || '',
  durationSeconds: Number(lesson.durationSeconds || lesson.duration || 0),
  cloudinaryPublicId: lesson.cloudinaryPublicId || lesson.publicId || null,
  playbackUrl: lesson.playbackUrl || lesson.videoUrl || null,
  posterUrl: lesson.posterUrl || lesson.thumbnailUrl || null,
  type: lesson.type || 'video',
  resources: ensureArray(lesson.resources),
  quiz: lesson.quiz || null,
});

const normalizeModule = (module, moduleIndex) => ({
  id: String(module.id || module.moduleId || `module-${moduleIndex + 1}`),
  title: module.title || `Module ${moduleIndex + 1}`,
  description: module.description || '',
  lessons: ensureArray(module.lessons).map(normalizeLesson),
});

export const normalizeCourse = (courseId, data = {}) => ({
  id: courseId,
  title: data.title || data.name || 'Untitled course',
  description: data.description || '',
  instructorName: data.instructorName || data.teacherName || data.professorName || 'Faculty',
  instituteId: data.instituteId || null,
  institutionType: normalizeInstitutionType(data),
  status: data.status || 'draft',
  published: data.published === true || data.status === 'published',
  classes: ensureArray(data.classes || data.standards),
  sections: ensureArray(data.sections),
  departments: ensureArray(data.departments || data.depts),
  semesters: ensureArray(data.semesters || data.sems),
  creditHours: Number(data.creditHours || 0),
  academicYear: data.academicYear || '',
  modules: ensureArray(data.modules).map(normalizeModule),
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

export const flattenLessons = (course) => ensureArray(course?.modules).flatMap((module) =>
  ensureArray(module.lessons).map((lesson) => ({ ...lesson, moduleId: module.id, moduleTitle: module.title }))
);

export const subscribeToLearnerCourse = ({ courseId, userData, onCourse, onError }) => {
  const profile = getInstitutionProfile(userData);

  if (!profile.instituteId) {
    onCourse(null);
    return () => {};
  }

  if (courseId) {
    const courseRef = doc(db, 'courses', courseId);
    return onSnapshot(courseRef, (snapshot) => {
      if (!snapshot.exists()) {
        onCourse(null);
        return;
      }

      const course = normalizeCourse(snapshot.id, snapshot.data());
      onCourse(courseMatchesLearnerScope(course, profile) || course.published ? course : null);
    }, onError);
  }

  const coursesQuery = query(
    collection(db, 'courses'),
    where('instituteId', '==', profile.instituteId)
  );

  return onSnapshot(coursesQuery, (snapshot) => {
    const matchingCourses = snapshot.docs
      .map((document) => normalizeCourse(document.id, document.data()))
      .filter((course) => course.published && courseMatchesLearnerScope(course, profile))
      .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));

    onCourse(matchingCourses[0] || null);
  }, onError);
};

export const progressDocumentId = (userId, courseId, lessonId) => `${userId}_${courseId}_${lessonId}`;

export const subscribeToLessonProgress = ({ userId, courseId, lessonId, onProgress, onError }) => {
  if (!userId || !courseId || !lessonId) {
    onProgress(null);
    return () => {};
  }

  const progressRef = doc(db, 'courseProgress', progressDocumentId(userId, courseId, lessonId));
  return onSnapshot(progressRef, (snapshot) => {
    onProgress(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
};

export const subscribeToCourseProgressList = ({ userId, courseId, onProgressList, onError }) => {
  if (!userId || !courseId) {
    onProgressList([]);
    return () => {};
  }

  const progressQuery = query(
    collection(db, 'courseProgress'),
    where('userId', '==', userId),
    where('courseId', '==', courseId)
  );

  return onSnapshot(progressQuery, (snapshot) => {
    onProgressList(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  }, onError);
};

export const saveLessonProgress = async ({
  userId,
  instituteId,
  courseId,
  lessonId,
  positionSeconds,
  durationSeconds,
  completed = false,
  notes,
}) => {
  if (!userId || !instituteId || !courseId || !lessonId) return;

  const progressRef = doc(db, 'courseProgress', progressDocumentId(userId, courseId, lessonId));
  const payload = {
    userId,
    instituteId,
    courseId,
    lessonId,
    positionSeconds: Math.max(0, Number(positionSeconds || 0)),
    durationSeconds: Math.max(0, Number(durationSeconds || 0)),
    completed: Boolean(completed),
    updatedAt: serverTimestamp(),
  };

  if (typeof notes === 'string') {
    payload.notes = notes;
  }

  if (completed) {
    payload.completedAt = serverTimestamp();
  }

  await setDoc(progressRef, payload, { merge: true });
};

export const readCourseById = async (courseId) => {
  if (!courseId) return null;
  const snapshot = await getDoc(doc(db, 'courses', courseId));
  return snapshot.exists() ? normalizeCourse(snapshot.id, snapshot.data()) : null;
};
