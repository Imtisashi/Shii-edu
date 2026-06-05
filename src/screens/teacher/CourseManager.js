import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import DynamicHeader from '../../components/DynamicHeader';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';
import { getInstitutionProfile } from '../../services/institutionalProfile';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';

const showMessage = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message || title);
    return;
  }
  Alert.alert(title, message);
};

const parseHttpsUrl = (value) => {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' ? parsed : null;
  } catch (_error) {
    return null;
  }
};
const isYouTubeUrl = (value) => {
  const parsed = parseHttpsUrl(value);
  if (!parsed) return false;
  const hostname = parsed.hostname.toLowerCase();
  return hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
};
const isHttpsUrl = (value) => Boolean(parseHttpsUrl(value));
const isSafeCloudinaryPublicId = (value) => {
  const candidate = String(value || '').trim();
  return /^[a-zA-Z0-9/_.-]+$/.test(candidate) &&
    !candidate.includes('..') &&
    !candidate.startsWith('/') &&
    !candidate.endsWith('/');
};

const createLessonFromInput = ({ title, description, mediaInput, durationMinutes }) => {
  const cleanMedia = mediaInput.trim();
  const durationSeconds = Math.max(0, Math.round(Number(durationMinutes || 0) * 60));
  const baseLesson = {
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    description: description.trim(),
    durationSeconds,
    resources: [],
    type: 'video',
  };

  if (isYouTubeUrl(cleanMedia)) {
    return {
      ...baseLesson,
      mediaProvider: 'youtube',
      youtubeUrl: cleanMedia,
      externalUrl: cleanMedia,
    };
  }

  if (isHttpsUrl(cleanMedia)) {
    return {
      ...baseLesson,
      mediaProvider: 'external',
      playbackUrl: cleanMedia,
      externalUrl: cleanMedia,
    };
  }

  if (!isSafeCloudinaryPublicId(cleanMedia)) {
    throw new Error('Use a secure YouTube/direct URL or a valid Cloudinary public ID.');
  }

  return {
    ...baseLesson,
    mediaProvider: 'cloudinary',
    cloudinaryPublicId: cleanMedia,
  };
};

export default function CourseManager({ navigation }) {
  const { userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const profile = getInstitutionProfile(userData);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [primaryTarget, setPrimaryTarget] = useState(profile.primaryValue || '');
  const [secondaryTarget, setSecondaryTarget] = useState(profile.secondaryValue || '');
  const [moduleTitle, setModuleTitle] = useState('Module 1');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [mediaInput, setMediaInput] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [draftLessons, setDraftLessons] = useState([]);

  useEffect(() => {
    setPrimaryTarget(profile.primaryValue || '');
    setSecondaryTarget(profile.secondaryValue || '');
  }, [profile.primaryValue, profile.secondaryValue]);

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const coursesQuery = query(
      collection(db, 'courses'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(coursesQuery, (snapshot) => {
      const nextCourses = snapshot.docs
        .map((courseDoc) => ({ id: courseDoc.id, ...courseDoc.data() }))
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
      setCourses(nextCourses);
      setLoading(false);
    }, (error) => {
      console.error('Course list failed:', error);
      setCourses([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.instituteId]);

  const targetLabel = useMemo(() => (
    profile.isCollege
      ? `${profile.academicRootLabel} / ${profile.academicChildLabel}`
      : `${profile.academicRootLabel} / ${profile.academicChildLabel}`
  ), [profile.academicChildLabel, profile.academicRootLabel, profile.isCollege]);

  const addDraftLesson = () => {
    if (!lessonTitle.trim() || !mediaInput.trim()) {
      showMessage('Incomplete Lesson', 'Add a lesson title and a YouTube URL, direct video URL, or Cloudinary public ID.');
      return;
    }

    let nextLesson;
    try {
      nextLesson = createLessonFromInput({
        title: lessonTitle,
        description: lessonDescription,
        mediaInput,
        durationMinutes,
      });
    } catch (error) {
      showMessage('Invalid Media', error.message || 'Use a secure YouTube/direct URL or Cloudinary public ID.');
      return;
    }

    setDraftLessons((previous) => [...previous, nextLesson]);
    setLessonTitle('');
    setLessonDescription('');
    setMediaInput('');
    setDurationMinutes('');
  };

  const removeDraftLesson = (lessonId) => {
    setDraftLessons((previous) => previous.filter((lesson) => lesson.id !== lessonId));
  };

  const publishCourse = async () => {
    if (!title.trim() || !primaryTarget.trim() || !secondaryTarget.trim() || draftLessons.length === 0) {
      showMessage('Incomplete Course', `Add a course title, ${targetLabel.toLowerCase()}, and at least one lesson.`);
      return;
    }

    setSaving(true);

    const primary = primaryTarget.trim();
    const secondary = secondaryTarget.trim();
    const coursePayload = {
      title: title.trim(),
      description: description.trim(),
      instituteId: userData.instituteId,
      institutionType: profile.institutionType,
      status: 'published',
      published: true,
      instructorId: userData.uid,
      instructorName: userData.name || 'Faculty',
      modules: [
        {
          id: `module-${Date.now()}`,
          title: moduleTitle.trim() || 'Module 1',
          description: '',
          lessons: draftLessons,
        },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (profile.isCollege) {
      coursePayload.departments = [primary];
      coursePayload.semesters = [secondary];
      coursePayload.creditHours = 0;
    } else {
      coursePayload.classes = [primary];
      coursePayload.sections = [secondary];
      coursePayload.academicYear = new Date().getFullYear().toString();
    }

    try {
      await addDoc(collection(db, 'courses'), coursePayload);
      setTitle('');
      setDescription('');
      setModuleTitle('Module 1');
      setDraftLessons([]);
      showMessage('Course Published', 'Students can now open this from the Courses button in their dashboard.');
    } catch (error) {
      console.error('Course publish failed:', error);
      showMessage('Publish Failed', 'The course could not be saved. Please check your connection and permissions.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (courseId) => {
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (error) {
      console.error('Course delete failed:', error);
      showMessage('Delete Failed', 'Could not delete this course.');
    }
  };

  const renderCourse = ({ item }) => (
    <View style={styles.courseCard}>
      <View style={styles.courseIcon}>
        <Ionicons name="play-circle" size={24} color="#2563EB" />
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseTitle}>{item.title || 'Untitled course'}</Text>
        <Text style={styles.courseMeta}>
          {profile.isCollege
            ? `${(item.departments || []).join(', ') || 'All departments'} - Sem ${(item.semesters || []).join(', ') || 'All'}`
            : `Class ${(item.classes || []).join(', ') || 'All'} - Sec ${(item.sections || []).join(', ') || 'All'}`}
        </Text>
        <Text style={styles.courseMeta}>{item.modules?.[0]?.lessons?.length || 0} lesson(s)</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCourse(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <DynamicHeader title="Course Uploader" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Publish Course</Text>
          <Text style={styles.helperText}>
            Add YouTube links, direct MP4/HLS links, or Cloudinary public IDs. Cloudinary IDs are signed at playback.
          </Text>

          <Text style={styles.label}>Course Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Physics: Motion and Forces" placeholderTextColor={colors.muted} />

          <Text style={styles.label}>Course Description</Text>
          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            value={description}
            onChangeText={setDescription}
            placeholder="What students will learn"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.row}>
            <View style={styles.rowCell}>
              <Text style={styles.label}>{profile.academicRootLabel}</Text>
              <TextInput style={styles.input} value={primaryTarget} onChangeText={setPrimaryTarget} placeholder={profile.isCollege ? 'CSE' : '10'} placeholderTextColor={colors.muted} />
            </View>
            <View style={styles.rowCell}>
              <Text style={styles.label}>{profile.academicChildLabel}</Text>
              <TextInput style={styles.input} value={secondaryTarget} onChangeText={setSecondaryTarget} placeholder={profile.isCollege ? '3' : 'A'} placeholderTextColor={colors.muted} />
            </View>
          </View>

          <Text style={styles.label}>Module Title</Text>
          <TextInput style={styles.input} value={moduleTitle} onChangeText={setModuleTitle} placeholder="Module 1" placeholderTextColor={colors.muted} />

          <View style={styles.lessonBox}>
            <Text style={styles.lessonBoxTitle}>Add Lesson</Text>
            <TextInput style={styles.input} value={lessonTitle} onChangeText={setLessonTitle} placeholder="Lesson title" placeholderTextColor={colors.muted} />
            <TextInput
              style={[styles.input, styles.textAreaSmall]}
              value={lessonDescription}
              onChangeText={setLessonDescription}
              placeholder="Lesson notes or objective"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              value={mediaInput}
              onChangeText={setMediaInput}
              placeholder="YouTube URL, MP4/HLS URL, or Cloudinary public ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              placeholder="Duration in minutes"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.secondaryBtn} onPress={addDraftLesson}>
              <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.secondaryBtnText}>Add Lesson to Course</Text>
            </TouchableOpacity>
          </View>

          {draftLessons.length > 0 && (
            <View style={styles.draftList}>
              {draftLessons.map((lesson, index) => (
                <View key={lesson.id} style={styles.draftLesson}>
                  <Text style={styles.draftLessonText}>{index + 1}. {lesson.title}</Text>
                  <TouchableOpacity onPress={() => removeDraftLesson(lesson.id)}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={[styles.publishBtn, saving && styles.disabled]} onPress={publishCourse} disabled={saving}>
            {saving ? <SmoothSpinner color="#fff" /> : <Text style={styles.publishBtnText}>Publish Course</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Published Courses</Text>
        {loading ? (
          <RosterSkeleton rowCount={4} showFilters={false} style={styles.embeddedSkeleton} />
        ) : (
          <FlatList
            data={courses}
            keyExtractor={(item) => item.id}
            renderItem={renderCourse}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No courses published yet.</Text>}
          />
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  scrollContent: { padding: 16, paddingBottom: 110 },
  embeddedSkeleton: { minHeight: 380 },
  card: { backgroundColor: '#0F172A', borderRadius: 8, padding: 18, borderWidth: 1, borderColor: '#334155', marginBottom: 22 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC' },
  helperText: { color: '#B9C6DD', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 16 },
  label: { fontSize: 12, color: '#8EA4C8', fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 13, fontSize: 15, marginBottom: 14, color: '#F8FAFC', outlineStyle: 'none' },
  textAreaSmall: { minHeight: 74 },
  row: { flexDirection: 'row', gap: 10 },
  rowCell: { flex: 1 },
  lessonBox: { backgroundColor: '#082F49', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#075985', marginBottom: 14 },
  lessonBoxTitle: { fontSize: 16, fontWeight: '900', color: '#67E8F9', marginBottom: 10 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', borderRadius: 8, borderWidth: 1, borderColor: '#075985', paddingVertical: 13 },
  secondaryBtnText: { color: '#2563EB', fontWeight: '900', marginLeft: 8 },
  draftList: { marginBottom: 14 },
  draftLesson: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 8 },
  draftLessonText: { flex: 1, color: '#F8FAFC', fontWeight: '800', marginRight: 10 },
  publishBtn: { backgroundColor: '#2563EB', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingVertical: 16, alignItems: 'center'},
  publishBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.7 },
  sectionTitle: { fontSize: 17, color: '#F8FAFC', fontWeight: '900', marginBottom: 12 },
  emptyText: { color: '#B9C6DD', fontWeight: '800' },
  courseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  courseIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#082F49', borderColor: '#075985', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  courseInfo: { flex: 1, minWidth: 0 },
  courseTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  courseMeta: { color: '#B9C6DD', fontSize: 12, marginTop: 3 },
  deleteBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#450A0A', borderColor: '#7F1D1D', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
});
