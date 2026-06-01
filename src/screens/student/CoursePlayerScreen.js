import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CoursePlayer from '../../components/course/CoursePlayer';
import InstitutionalLayout from '../../components/institution/InstitutionalLayout';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToLearnerCourse } from '../../services/courseService';
import { Colors, Radius, Spacing } from '../../constants/theme';

export default function CoursePlayerScreen({ route, navigation }) {
  const { userData } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const courseId = route?.params?.courseId || null;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToLearnerCourse({
      courseId,
      userData,
      onCourse: (nextCourse) => {
        setCourse(nextCourse);
        setLoading(false);
      },
      onError: (courseError) => {
        console.error('Course subscription failed:', courseError);
        setError(courseError);
        setLoading(false);
      },
    });

    return () => unsubscribe();
  }, [courseId, userData]);

  return (
    <InstitutionalLayout
      userData={userData}
      title="Learning Player"
      subtitle="Stream assigned lessons, track completion, and keep durable notes against each lesson."
      scroll={false}
      actions={(
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#EFF6FF',
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
          }}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="home-outline" size={17} color={Colors.primary} />
          <Text style={{ color: Colors.primary, fontWeight: '900', marginLeft: 6 }}>Dashboard</Text>
        </TouchableOpacity>
      )}
    >
      <CoursePlayer course={course} loading={loading} error={error} />
    </InstitutionalLayout>
  );
}
