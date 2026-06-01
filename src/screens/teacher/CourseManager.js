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
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';
import { getInstitutionProfile } from '../../services/institutionalProfile';

const showMessage = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message || title);
    return;
  }
  Alert.alert(title, message);
};

const isYouTubeUrl = (value) => /(?:youtube\.com|youtu\.be)/i.test(String(value || ''));
const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));

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

  if (isHttpUrl(cleanMedia)) {
    return {
      ...baseLesson,
      mediaProvider: 'external',
      playbackUrl: cleanMedia,
      externalUrl: cleanMedia,
    };
  }

  return {
    ...baseLesson,
    mediaProvider: 'cloudinary',
    cloudinaryPublicId: cleanMedia,
  };
};

export default function CourseManager({ navigation }) {
  const { userData } = useAuth();
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

    const nextLesson = createLessonFromInput({
      title: lessonTitle,
      description: lessonDescription,
      mediaInput,
      durationMinutes,
    });

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
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Physics: Motion and Forces" />

          <Text style={styles.label}>Course Description</Text>
          <TextInput
            style={[styles.input, styles.textAreaSmall]}
            value={description}
            onChangeText={setDescription}
            placeholder="What students will learn"
            multiline
            textAlignVertical="top"
          />

          <View style={styles.row}>
            <View style={styles.rowCell}>
              <Text style={styles.label}>{profile.academicRootLabel}</Text>
              <TextInput style={styles.input} value={primaryTarget} onChangeText={setPrimaryTarget} placeholder={profile.isCollege ? 'CSE' : '10'} />
            </View>
            <View style={styles.rowCell}>
              <Text style={styles.label}>{profile.academicChildLabel}</Text>
              <TextInput style={styles.input} value={secondaryTarget} onChangeText={setSecondaryTarget} placeholder={profile.isCollege ? '3' : 'A'} />
            </View>
          </View>

          <Text style={styles.label}>Module Title</Text>
          <TextInput style={styles.input} value={moduleTitle} onChangeText={setModuleTitle} placeholder="Module 1" />

          <View style={styles.lessonBox}>
            <Text style={styles.lessonBoxTitle}>Add Lesson</Text>
            <TextInput style={styles.input} value={lessonTitle} onChangeText={setLessonTitle} placeholder="Lesson title" />
            <TextInput
              style={[styles.input, styles.textAreaSmall]}
              value={lessonDescription}
              onChangeText={setLessonDescription}
              placeholder="Lesson notes or objective"
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.input}
              value={mediaInput}
              onChangeText={setMediaInput}
              placeholder="YouTube URL, MP4/HLS URL, or Cloudinary public ID"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              placeholder="Duration in minutes"
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
          <SmoothSpinner color="#2563EB" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 110 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 22 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  helperText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 16 },
  label: { fontSize: 12, color: '#475569', fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 14, color: '#0F172A', outlineStyle: 'none' },
  textAreaSmall: { minHeight: 74 },
  row: { flexDirection: 'row', gap: 10 },
  rowCell: { flex: 1 },
  lessonBox: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 14 },
  lessonBoxTitle: { fontSize: 16, fontWeight: '900', color: '#1D4ED8', marginBottom: 10 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 13 },
  secondaryBtnText: { color: '#2563EB', fontWeight: '900', marginLeft: 8 },
  draftList: { marginBottom: 14 },
  draftLesson: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 8 },
  draftLessonText: { flex: 1, color: '#0F172A', fontWeight: '800', marginRight: 10 },
  publishBtn: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  publishBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.7 },
  sectionTitle: { fontSize: 17, color: '#0F172A', fontWeight: '900', marginBottom: 12 },
  emptyText: { color: '#94A3B8', fontStyle: 'italic' },
  courseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  courseIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  courseInfo: { flex: 1, minWidth: 0 },
  courseTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  courseMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  deleteBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
});
