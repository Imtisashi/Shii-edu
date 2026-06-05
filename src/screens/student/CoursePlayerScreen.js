import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import CoursePlayer from '../../components/course/CoursePlayer';
import StudentScreenScaffold, { ScreenIntro } from '../../components/student/StudentScreenScaffold';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { subscribeToLearnerCourse } from '../../services/courseService';

export default function CoursePlayerScreen({ route }) {
  const { userData } = useAuth();
  const { colors } = useRootLayout();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const courseId = route?.params?.courseId || null;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToLearnerCourse({
      courseId,
      onCourse: (nextCourse) => {
        setCourse(nextCourse);
        setLoading(false);
      },
      onError: (courseError) => {
        console.error('Course subscription failed:', courseError);
        setError(courseError);
        setLoading(false);
      },
      userData,
    });

    return () => unsubscribe();
  }, [courseId, userData]);

  return (
    <StudentScreenScaffold accentVariant="blue" showBack title="Courses">
      <ScreenIntro
        accentColor={colors.deepBlue}
        eyebrow="Learning player"
        subtitle="Stream assigned lessons, track completion, and keep durable notes against each lesson."
        title="Courses"
        trailing={<Ionicons name="play-circle" size={28} color={colors.deepBlue} />}
      />
      <CoursePlayer course={course} error={error} loading={loading} />
    </StudentScreenScaffold>
  );
}
