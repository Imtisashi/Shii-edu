import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const SAVE_INTERVAL_MS = 10000;

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
      borderRadius: 18,
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
      borderRadius: 18,
      objectFit: 'contain',
      display: 'block',
    },
  });
}

function NativeVideoFallback({ sourceUrl }) {
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
    if (!currentUser?.uid || !course?.id) {
      setProgressRecords([]);
      return undefined;
    }

    return subscribeToCourseProgressList({
      userId: currentUser.uid,
      courseId: course.id,
      onProgressList: setProgressRecords,
      onError: (progressError) => {
        console.error('Course progress subscription failed:', progressError);
        setProgressRecords([]);
      },
    });
  }, [course?.id, currentUser?.uid]);

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

  const persistProgress = async ({ force = false, completed = false } = {}) => {
    if (!currentUser?.uid || !userData?.instituteId || !course?.id || !selectedLesson?.id) return;

    const now = Date.now();
    if (!force && now - lastSavedAtRef.current < SAVE_INTERVAL_MS) return;
    lastSavedAtRef.current = now;

    const snapshot = lastProgressRef.current;
    await saveLessonProgress({
      userId: currentUser.uid,
      instituteId: userData.instituteId,
      courseId: course.id,
      lessonId: selectedLesson.id,
      positionSeconds: snapshot.positionSeconds,
      durationSeconds: snapshot.durationSeconds || selectedLesson.durationSeconds,
      completed: completed || snapshot.completed,
      notes,
    }).catch((saveError) => {
      console.error('Progress save failed:', saveError);
    });
  };

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
  }, [course?.id, currentUser?.uid, notes, selectedLesson?.id, userData?.instituteId]);

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
                  <Ionicons name={record?.completed ? 'checkmark' : 'play'} size={13} color={record?.completed ? '#FFFFFF' : Colors.primary} />
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
    return (
      <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>Loading course...</Text>
      </View>
    );
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
        <Ionicons name="albums-outline" size={42} color={Colors.border} />
        <Text style={styles.stateTitle}>No published course is assigned to your profile yet.</Text>
        <Text style={styles.stateText}>Courses appear here after your institute publishes one for your class or department.</Text>
      </View>
    );
  }

  if (!selectedLesson) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="videocam-off-outline" size={42} color={Colors.border} />
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
            <Ionicons name="list" size={18} color={Colors.primary} />
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
              <NativeVideoFallback sourceUrl={playbackUrl} />
            ) : Platform.OS === 'web' ? (
              <WebHlsVideo
                sourceUrl={playbackUrl}
                posterUrl={posterUrl}
                initialPositionSeconds={selectedProgress?.positionSeconds || 0}
                onProgress={handleProgress}
                onEnded={handleEnded}
              />
            ) : (
              <NativeVideoFallback sourceUrl={playbackUrl} />
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
              <Ionicons name="checkmark-done" size={17} color={Colors.success} />
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
          placeholderTextColor="#94A3B8"
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
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {renderSyllabus()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  playerShell: { gap: Spacing.md },
  playerShellDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  sidebar: {
    width: 300,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    maxHeight: 720,
  },
  syllabusScroll: { flexGrow: 0 },
  syllabusContent: { padding: Spacing.md, paddingBottom: Spacing.lg },
  moduleBlock: { marginBottom: Spacing.lg },
  moduleEyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  moduleTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900', marginTop: 3, marginBottom: Spacing.sm },
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
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  lessonStatus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  lessonStatusDone: { backgroundColor: Colors.success },
  lessonTextBlock: { flex: 1, minWidth: 0 },
  lessonTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  lessonTitleActive: { color: Colors.primary },
  lessonMeta: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  learningPanel: { flex: 1.6, minWidth: 0 },
  mobileSyllabusButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  mobileSyllabusText: { color: Colors.primary, fontWeight: '900', marginLeft: Spacing.xs },
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  progressValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '900', marginTop: 2 },
  progressBar: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.success },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    minHeight: 260,
    backgroundColor: '#020617',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
  },
  videoState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  videoStateText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center', marginTop: Spacing.sm },
  nativeVideoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  nativeVideoTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: Spacing.sm },
  nativeVideoText: { color: '#CBD5E1', textAlign: 'center', marginTop: Spacing.xs, lineHeight: 20 },
  nativeVideoButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill, marginTop: Spacing.md },
  nativeVideoButtonText: { color: '#FFFFFF', fontWeight: '900' },
  lessonHeader: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  nowPlaying: { color: Colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  selectedLessonTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', marginTop: 4 },
  selectedLessonDescription: { color: Colors.textSecondary, lineHeight: 21, marginTop: Spacing.xs },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  completedBadgeText: { color: '#FFFFFF', fontWeight: '900', marginLeft: 5, fontSize: 12 },
  markCompleteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: '#BBF7D0' },
  markCompleteText: { color: Colors.success, fontWeight: '900', marginLeft: 5, fontSize: 12 },
  interactionPanel: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    minWidth: 0,
  },
  panelTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '900' },
  panelText: { color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.xs, marginBottom: Spacing.md },
  notesInput: {
    minHeight: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 14,
    outlineStyle: 'none',
  },
  resourcesBlock: { marginTop: Spacing.lg },
  resourcesTitle: { color: Colors.textPrimary, fontWeight: '900', marginBottom: Spacing.sm },
  resourceItem: { color: Colors.primary, fontWeight: '700', marginBottom: Spacing.xs },
  stateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  stateTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: Spacing.sm },
  stateText: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: Spacing.xs },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '82%', backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: Spacing.sm },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: Spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  sheetTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '900' },
  sheetClose: { padding: Spacing.xs },
});
