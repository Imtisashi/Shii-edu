import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { Colors, Radius, Spacing } from '../../constants/theme';
import {
  flattenLessons,
  saveLessonProgress,
  subscribeToCourseProgressList,
} from '../../services/courseService';
import { requestSignedPlaybackUrl } from '../../services/cloudinaryMediaService';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { RosterSkeleton } from '../ui/LoadingState';

const SAVE_INTERVAL_MS = 10000;
const COURSE_CARD = '#0F172A';
const COURSE_BORDER = '#334155';
const COURSE_TEXT = '#F8FAFC';
const COURSE_TEXT_SOFT = '#B9C6DD';
const COURSE_MUTED = '#8EA4C8';
const COURSE_BLUE_SOFT = '#082F49';
const COURSE_GREEN = '#16A34A';
const COURSE_GREEN_SOFT = '#052E2B';

const secondsToLabel = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const getYouTubeEmbedUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return null;

  const match = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (!match) return null;

  return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1&playsinline=1`;
};

function WebYouTubePlayer({ embedUrl }) {
  return React.createElement('iframe', {
    src: embedUrl,
    title: 'YouTube lesson player',
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowFullScreen: true,
    style: {
      width: '100%',
      height: '100%',
      minHeight: 260,
      border: 0,
      backgroundColor: '#020617',
      borderRadius: 8,
      display: 'block',
    },
  });
}

function WebHlsVideo({ sourceUrl, posterUrl, initialPositionSeconds, onProgress, onEnded }) {
  const videoRef = useRef(null);

  useEffect(() => {
    let hlsInstance = null;
    let cancelled = false;
    const video = videoRef.current;

    if (!video || !sourceUrl) return undefined;

    const attachSource = async () => {
      const isHls = sourceUrl.includes('.m3u8');
      if (!isHls || video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = sourceUrl;
        return;
      }

      const hlsModule = await import('hls.js');
      const Hls = hlsModule.default;
      if (cancelled) return;

      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
        });
        hlsInstance.loadSource(sourceUrl);
        hlsInstance.attachMedia(video);
      } else {
        video.src = sourceUrl;
      }
    };

    attachSource().catch((error) => {
      console.error('Unable to attach HLS stream:', error);
      video.src = sourceUrl;
    });

    return () => {
      cancelled = true;
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [sourceUrl]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const resumeAt = Number(initialPositionSeconds || 0);
    if (video && resumeAt > 0 && Number.isFinite(video.duration) && resumeAt < video.duration - 3) {
      video.currentTime = resumeAt;
    }
  };

  return React.createElement('video', {
    ref: videoRef,
    controls: true,
    playsInline: true,
    poster: posterUrl || undefined,
    onLoadedMetadata: handleLoadedMetadata,
    onTimeUpdate: (event) => {
      const target = event.currentTarget;
      onProgress({
        positionSeconds: target.currentTime,
        durationSeconds: target.duration,
      });
    },
    onEnded,
    style: {
      width: '100%',
      height: '100%',
      minHeight: 260,
      backgroundColor: '#020617',
      borderRadius: 8,
      objectFit: 'contain',
      display: 'block',
    },
  });
}

function NativeVideoFallback({ sourceUrl, styles }) {
  return (
    <View style={styles.nativeVideoFallback}>
      <Ionicons name="play-circle" size={54} color="#FFFFFF" />
      <Text style={styles.nativeVideoTitle}>Secure lesson video</Text>
      <Text style={styles.nativeVideoText}>
        This device will open the signed stream in the system browser.
      </Text>
      <TouchableOpacity
        style={styles.nativeVideoButton}
        onPress={() => sourceUrl && WebBrowser.openBrowserAsync(sourceUrl)}
        disabled={!sourceUrl}
      >
        <Text style={styles.nativeVideoButtonText}>Open Video</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CoursePlayer({ course, loading = false, error = null }) {
  const { currentUser, userData } = useAuth();
  const layout = useResponsiveLayout();
  const { colors, styles } = useInstituteTheme(baseStyles);
  const lessons = useMemo(() => flattenLessons(course), [course]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [progressRecords, setProgressRecords] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [posterUrl, setPosterUrl] = useState(null);
  const [playbackError, setPlaybackError] = useState(null);
  const lastProgressRef = useRef({ positionSeconds: 0, durationSeconds: 0, completed: false });
  const lastSavedAtRef = useRef(0);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) || lessons[0] || null,
    [lessons, selectedLessonId]
  );

  const progressByLesson = useMemo(() => {
    const map = new Map();
    progressRecords.forEach((record) => {
      map.set(record.lessonId, record);
    });
    return map;
  }, [progressRecords]);

  const selectedProgress = selectedLesson ? progressByLesson.get(selectedLesson.id) : null;
  const courseId = course?.id || null;
  const currentUserUid = currentUser?.uid || null;
  const instituteId = userData?.instituteId || null;
  const selectedLessonDurationSeconds = selectedLesson?.durationSeconds || 0;
  const selectedLessonStableId = selectedLesson?.id || null;
  const youtubeEmbedUrl = selectedLesson
    ? getYouTubeEmbedUrl(selectedLesson.youtubeUrl || selectedLesson.externalUrl || selectedLesson.playbackUrl)
    : null;
  const completedCount = lessons.filter((lesson) => progressByLesson.get(lesson.id)?.completed).length;
  const completionPercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  useEffect(() => {
    if (!selectedLessonId && lessons[0]) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (!currentUserUid || !courseId) {
      setProgressRecords([]);
      return undefined;
    }

    return subscribeToCourseProgressList({
      userId: currentUserUid,
      instituteId,
      courseId,
      onProgressList: setProgressRecords,
      onError: (progressError) => {
        console.error('Course progress subscription failed:', progressError);
        setProgressRecords([]);
      },
    });
  }, [courseId, currentUserUid, instituteId]);

  useEffect(() => {
    setNotes(selectedProgress?.notes || '');
    lastProgressRef.current = {
      positionSeconds: Number(selectedProgress?.positionSeconds || 0),
      durationSeconds: Number(selectedProgress?.durationSeconds || selectedLesson?.durationSeconds || 0),
      completed: Boolean(selectedProgress?.completed),
    };
  }, [selectedLesson?.id, selectedLesson?.durationSeconds, selectedProgress]);

  useEffect(() => {
    let cancelled = false;
    setPlaybackError(null);
    setPlaybackUrl(null);
    setPosterUrl(selectedLesson?.posterUrl || null);

    const resolvePlayback = async () => {
      if (!selectedLesson) return;
      if (youtubeEmbedUrl) {
        setPlaybackUrl(selectedLesson.youtubeUrl || selectedLesson.externalUrl || selectedLesson.playbackUrl);
        return;
      }
      if (selectedLesson.playbackUrl || selectedLesson.externalUrl) {
        setPlaybackUrl(selectedLesson.playbackUrl || selectedLesson.externalUrl);
        return;
      }
      if (!selectedLesson.cloudinaryPublicId) {
        setPlaybackError('This lesson has no playable media attached yet.');
        return;
      }

      try {
        const signed = await requestSignedPlaybackUrl({
          currentUser,
          courseId: course.id,
          lessonId: selectedLesson.id,
          publicId: selectedLesson.cloudinaryPublicId,
        });
        if (!cancelled) {
          setPlaybackUrl(signed.playbackUrl);
          setPosterUrl(selectedLesson.posterUrl || signed.posterUrl || null);
        }
      } catch (signedError) {
        console.error('Signed playback request failed:', signedError);
        if (!cancelled) {
          setPlaybackError('Unable to prepare the secure video stream for this lesson.');
        }
      }
    };

    resolvePlayback();
    return () => {
      cancelled = true;
    };
  }, [course?.id, currentUser, selectedLesson, youtubeEmbedUrl]);

  const persistProgress = useCallback(async ({ force = false, completed = false } = {}) => {
    if (!currentUserUid || !instituteId || !courseId || !selectedLessonStableId) return;

    const now = Date.now();
    if (!force && now - lastSavedAtRef.current < SAVE_INTERVAL_MS) return;
    lastSavedAtRef.current = now;

    const snapshot = lastProgressRef.current;
    await saveLessonProgress({
      userId: currentUserUid,
      instituteId,
      courseId,
      lessonId: selectedLessonStableId,
      positionSeconds: snapshot.positionSeconds,
      durationSeconds: snapshot.durationSeconds || selectedLessonDurationSeconds,
      completed: completed || snapshot.completed,
      notes,
    }).catch((saveError) => {
      console.error('Progress save failed:', saveError);
    });
  }, [courseId, currentUserUid, instituteId, notes, selectedLessonDurationSeconds, selectedLessonStableId]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const flush = () => persistProgress({ force: true });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [persistProgress]);

  const handleProgress = ({ positionSeconds, durationSeconds }) => {
    const completed = durationSeconds > 0 && positionSeconds / durationSeconds >= 0.9;
    lastProgressRef.current = {
      positionSeconds,
      durationSeconds,
      completed: completed || lastProgressRef.current.completed,
    };
    persistProgress({ completed });
  };

  const handleLessonChange = (lessonId) => {
    persistProgress({ force: true });
    setSelectedLessonId(lessonId);
    setSheetOpen(false);
  };

  const handleEnded = () => {
    lastProgressRef.current = {
      ...lastProgressRef.current,
      completed: true,
    };
    persistProgress({ force: true, completed: true });
  };

  const handleManualComplete = () => {
    const durationSeconds = selectedLesson?.durationSeconds || lastProgressRef.current.durationSeconds || 0;
    lastProgressRef.current = {
      positionSeconds: durationSeconds,
      durationSeconds,
      completed: true,
    };
    persistProgress({ force: true, completed: true });
  };

  const renderSyllabus = () => (
    <ScrollView style={styles.syllabusScroll} contentContainerStyle={styles.syllabusContent}>
      {course.modules.map((module, moduleIndex) => (
        <View key={module.id} style={styles.moduleBlock}>
          <Text style={styles.moduleEyebrow}>Module {moduleIndex + 1}</Text>
          <Text style={styles.moduleTitle}>{module.title}</Text>
          {module.lessons.map((lesson) => {
            const isActive = lesson.id === selectedLesson?.id;
            const record = progressByLesson.get(lesson.id);
            return (
              <TouchableOpacity
                key={lesson.id}
                style={[styles.lessonRow, isActive && styles.lessonRowActive]}
                onPress={() => handleLessonChange(lesson.id)}
                accessibilityLabel={`Open ${lesson.title}`}
              >
                <View style={[styles.lessonStatus, record?.completed && styles.lessonStatusDone]}>
                  <Ionicons name={record?.completed ? 'checkmark' : 'play'} size={13} color={record?.completed ? '#FFFFFF' : '#93C5FD'} />
                </View>
                <View style={styles.lessonTextBlock}>
                  <Text style={[styles.lessonTitle, isActive && styles.lessonTitleActive]} numberOfLines={2}>{lesson.title}</Text>
                  <Text style={styles.lessonMeta}>{secondsToLabel(lesson.durationSeconds)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );

  if (loading) {
    return <RosterSkeleton rowCount={4} showFilters={false} />;
  }

  if (error) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="warning-outline" size={36} color={Colors.error} />
        <Text style={styles.stateTitle}>Course could not be loaded</Text>
        <Text style={styles.stateText}>{String(error.message || error)}</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="albums-outline" size={42} color={colors.muted} />
        <Text style={styles.stateTitle}>No published course is assigned to your profile yet.</Text>
        <Text style={styles.stateText}>Courses appear here after your institute publishes one for your class or department.</Text>
      </View>
    );
  }

  if (!selectedLesson) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="videocam-off-outline" size={42} color={colors.muted} />
        <Text style={styles.stateTitle}>This course has no lessons yet.</Text>
        <Text style={styles.stateText}>Ask your faculty team to add at least one lesson before publishing this course.</Text>
      </View>
    );
  }

  return (
      <View style={[styles.playerShell, layout.isDesktop && styles.playerShellDesktop]}>
      {!layout.isMobile ? <View style={styles.sidebar}>{renderSyllabus()}</View> : null}

      <View style={styles.learningPanel}>
        {layout.isMobile ? (
          <TouchableOpacity style={styles.mobileSyllabusButton} onPress={() => setSheetOpen(true)}>
            <Ionicons name="list" size={18} color={colors.text} />
            <Text style={styles.mobileSyllabusText}>Open syllabus</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.progressCard}>
          <View>
            <Text style={styles.progressLabel}>Course progress</Text>
            <Text style={styles.progressValue}>{completionPercent}% complete</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
          </View>
        </View>

        <View style={styles.videoFrame}>
          {playbackError ? (
            <View style={styles.videoState}>
              <Ionicons name="lock-closed-outline" size={40} color="#FFFFFF" />
              <Text style={styles.videoStateText}>{playbackError}</Text>
            </View>
          ) : playbackUrl ? (
            youtubeEmbedUrl && Platform.OS === 'web' ? (
              <WebYouTubePlayer embedUrl={youtubeEmbedUrl} />
            ) : youtubeEmbedUrl ? (
              <NativeVideoFallback sourceUrl={playbackUrl} styles={styles} />
            ) : Platform.OS === 'web' ? (
              <WebHlsVideo
                sourceUrl={playbackUrl}
                posterUrl={posterUrl}
                initialPositionSeconds={selectedProgress?.positionSeconds || 0}
                onProgress={handleProgress}
                onEnded={handleEnded}
              />
            ) : (
              <NativeVideoFallback sourceUrl={playbackUrl} styles={styles} />
            )
          ) : (
            <View style={styles.videoState}>
              <Ionicons name="hourglass-outline" size={40} color="#FFFFFF" />
              <Text style={styles.videoStateText}>Preparing secure stream...</Text>
            </View>
          )}
        </View>

        <View style={styles.lessonHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nowPlaying}>Now playing</Text>
            <Text style={styles.selectedLessonTitle}>{selectedLesson.title}</Text>
            {selectedLesson.description ? <Text style={styles.selectedLessonDescription}>{selectedLesson.description}</Text> : null}
          </View>
          {selectedProgress?.completed ? (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
              <Text style={styles.completedBadgeText}>Completed</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.markCompleteBtn} onPress={handleManualComplete}>
              <Ionicons name="checkmark-done" size={17} color={COURSE_GREEN} />
              <Text style={styles.markCompleteText}>Mark Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.interactionPanel}>
        <Text style={styles.panelTitle}>Lesson Notes</Text>
        <Text style={styles.panelText}>Notes autosave with your playback progress and sync to your account.</Text>
        <TextInput
          style={styles.notesInput}
          multiline
          textAlignVertical="top"
          value={notes}
          onChangeText={setNotes}
          onBlur={() => persistProgress({ force: true })}
          placeholder="Write clean study notes for this lesson..."
          placeholderTextColor={colors.muted}
        />
        {selectedLesson.resources.length ? (
          <View style={styles.resourcesBlock}>
            <Text style={styles.resourcesTitle}>Resources</Text>
            {selectedLesson.resources.map((resource) => (
              <Text key={resource.url || resource.title} style={styles.resourceItem}>{resource.title || resource.url}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Course syllabus</Text>
              <TouchableOpacity onPress={() => setSheetOpen(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={22} color={colors.textSoft} />
              </TouchableOpacity>
            </View>
            {renderSyllabus()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  playerShell: { gap: Spacing.md },
  playerShellDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  sidebar: {
    width: 300,
    backgroundColor: COURSE_CARD,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
    overflow: 'hidden',
    maxHeight: 720,
  },
  syllabusScroll: { flexGrow: 0 },
  syllabusContent: { padding: Spacing.md, paddingBottom: Spacing.lg },
  moduleBlock: { marginBottom: Spacing.lg },
  moduleEyebrow: { color: '#38BDF8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  moduleTitle: { color: COURSE_TEXT, fontSize: 16, fontWeight: '900', marginTop: 3, marginBottom: Spacing.sm },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lessonRowActive: {
    backgroundColor: COURSE_BLUE_SOFT,
    borderColor: '#2563EB',
  },
  lessonStatus: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COURSE_BLUE_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  lessonStatusDone: { backgroundColor: COURSE_GREEN },
  lessonTextBlock: { flex: 1, minWidth: 0 },
  lessonTitle: { color: COURSE_TEXT, fontSize: 13, fontWeight: '800' },
  lessonTitleActive: { color: '#93C5FD' },
  lessonMeta: { color: COURSE_MUTED, fontSize: 11, marginTop: 2 },
  learningPanel: { flex: 1.6, minWidth: 0 },
  mobileSyllabusButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COURSE_BLUE_SOFT,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
  },
  mobileSyllabusText: { color: COURSE_TEXT, fontWeight: '900', marginLeft: Spacing.xs },
  progressCard: {
    backgroundColor: COURSE_CARD,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressLabel: { color: COURSE_MUTED, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  progressValue: { color: COURSE_TEXT, fontSize: 18, fontWeight: '900', marginTop: 2 },
  progressBar: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#111827', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COURSE_GREEN },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    minHeight: 260,
    backgroundColor: '#020617',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
  },
  videoState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  videoStateText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center', marginTop: Spacing.sm },
  nativeVideoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  nativeVideoTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: Spacing.sm },
  nativeVideoText: { color: '#CBD5E1', textAlign: 'center', marginTop: Spacing.xs, lineHeight: 20 },
  nativeVideoButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.lg, marginTop: Spacing.md },
  nativeVideoButtonText: { color: '#FFFFFF', fontWeight: '900' },
  lessonHeader: {
    backgroundColor: COURSE_CARD,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  nowPlaying: { color: '#93C5FD', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  selectedLessonTitle: { color: COURSE_TEXT, fontSize: 22, fontWeight: '900', marginTop: 4 },
  selectedLessonDescription: { color: COURSE_TEXT_SOFT, lineHeight: 21, marginTop: Spacing.xs },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COURSE_GREEN, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  completedBadgeText: { color: '#FFFFFF', fontWeight: '900', marginLeft: 5, fontSize: 12 },
  markCompleteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COURSE_GREEN_SOFT, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: COURSE_BORDER },
  markCompleteText: { color: COURSE_TEXT, fontWeight: '900', marginLeft: 5, fontSize: 12 },
  interactionPanel: {
    flex: 1,
    backgroundColor: COURSE_CARD,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
    padding: Spacing.lg,
    minWidth: 0,
  },
  panelTitle: { color: COURSE_TEXT, fontSize: 19, fontWeight: '900' },
  panelText: { color: COURSE_TEXT_SOFT, lineHeight: 20, marginTop: Spacing.xs, marginBottom: Spacing.md },
  notesInput: {
    minHeight: 180,
    backgroundColor: '#111827',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
    padding: Spacing.md,
    color: COURSE_TEXT,
    fontSize: 14,
    outlineStyle: 'none',
  },
  resourcesBlock: { marginTop: Spacing.lg },
  resourcesTitle: { color: COURSE_TEXT, fontWeight: '900', marginBottom: Spacing.sm },
  resourceItem: { color: '#93C5FD', fontWeight: '700', marginBottom: Spacing.xs },
  stateCard: {
    backgroundColor: COURSE_CARD,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: COURSE_BORDER,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  stateTitle: { color: COURSE_TEXT, fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: Spacing.sm },
  stateText: { color: COURSE_TEXT_SOFT, textAlign: 'center', lineHeight: 21, marginTop: Spacing.xs },
  sheetBackdrop: { flex: 1, backgroundColor: '#020617', justifyContent: 'flex-end' },
  sheet: { maxHeight: '82%', backgroundColor: '#070B16', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: Spacing.sm, borderWidth: 1, borderColor: COURSE_BORDER },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COURSE_BORDER, alignSelf: 'center', marginBottom: Spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  sheetTitle: { color: COURSE_TEXT, fontSize: 19, fontWeight: '900' },
  sheetClose: { padding: Spacing.xs },
});
