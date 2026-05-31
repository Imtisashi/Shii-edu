import React, { useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ImageBackground, Animated, Platform, Image, StatusBar 
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import PremiumActionCard from '../../components/ui/PremiumActionCard';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

export default function TeacherHome() {
  const navigation = useNavigation();
  const { userData, logout } = useAuth();
  const layout = useResponsiveLayout();

  // Enterprise Scroll Animation Values
  const scrollY = useRef(new Animated.Value(0)).current;

  const teacherName = userData?.name || "Teacher";
  const initials = teacherName.charAt(0).toUpperCase();
  const instituteName = userData?.instituteData?.name || "Edu-Hub Campus";
  
  const instTypeStr = (userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = instTypeStr.includes('school');

  // Interpolations for Parallax & Glass Header
  const headerOpacity = scrollY.interpolate({
    inputRange: [50, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const heroTranslateY = scrollY.interpolate({
    inputRange: [-100, 0, 200],
    outputRange: [0, 0, 100],
    extrapolate: 'clamp',
  });

  const heroScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  const renderBadges = () => {
    if (userData?.isClassTeacher) {
      const p1 = isSchool ? `Class ${userData?.assignedClass || 'N/A'}` : (userData?.assignedDept || 'N/A');
      const p2 = isSchool ? `Sec ${userData?.assignedSection || 'N/A'}` : `Sem ${userData?.assignedSem || 'N/A'}`;
      return (
        <View style={styles.pillContainer}>
          <View style={[styles.pillBadge, {backgroundColor: 'rgba(16, 185, 129, 0.3)', borderColor: '#10B981'}]}>
             <Ionicons name="star" size={12} color="#fff" style={{marginRight: 4}} />
             <Text style={styles.pillText}>Advisor</Text>
          </View>
          <View style={styles.pillBadge}><Text style={styles.pillText}>{p1}</Text></View>
          <View style={styles.pillBadge}><Text style={styles.pillText}>{p2}</Text></View>
        </View>
      );
    } else {
      return (
        <View style={styles.pillContainer}>
          <View style={styles.pillBadge}><Text style={styles.pillText}>Subject Teacher</Text></View>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* STICKY GLASSMORPHISM HEADER */}
      <Animated.View style={[styles.glassHeader, { opacity: headerOpacity }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.95)' }]} />
        )}
        <View style={styles.glassHeaderContent}>
          <Text style={styles.glassTitle}>Faculty Portal</Text>
          <View style={[styles.glassAvatar, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.glassAvatarText}>{initials}</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, layout.isDesktop && styles.scrollContentDesktop]}
      >
        {/* PARALLAX HERO SECTION */}
        <Animated.View
          style={[
            styles.heroContainer,
            { height: layout.heroHeight },
            layout.isDesktop && styles.heroContainerDesktop,
            layout.isDesktop && { maxWidth: layout.maxContentWidth },
            { transform: [{ translateY: heroTranslateY }, { scale: heroScale }] },
          ]}
        >
           <ImageBackground 
            source={{ uri: userData?.instituteData?.heroImage || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1000&auto=format&fit=crop' }}             style={styles.heroImage}
           >
             <View style={[styles.heroGradient, layout.isDesktop && styles.heroGradientDesktop, { backgroundColor: 'rgba(76, 29, 149, 0.65)' }]}>
               <Text style={styles.instituteHeading}>{instituteName}</Text>
               <View style={styles.profileRow}>
                  {userData?.profilePic ? (
                    <Image source={{ uri: userData.profilePic }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>{initials}</Text></View>
                  )}
                  <View style={styles.greetingBlock}>
                    <Text style={styles.greeting}>Faculty Portal,</Text>
                    <Text style={styles.greetingName}>{teacherName.split(' ')[0]}</Text>
                  </View>
               </View>
               {renderBadges()}
             </View>
           </ImageBackground>
        </Animated.View>

        <View style={[styles.bodyContent, layout.isDesktop && styles.bodyContentDesktop, layout.isDesktop && { maxWidth: layout.maxContentWidth }]}>
          <Text style={styles.sectionTitle}>Command Center</Text>
          
          <View style={[styles.gridContainer, layout.isDesktop && styles.gridContainerDesktop]}>
            <PremiumActionCard columns={layout.dashboardColumns} compact={layout.isCompact} title="Attendance" icon="checkmark-done-circle" color="#10B981" bgColor="#ECFDF5" delay={100} onPress={() => navigation.navigate('Attendance')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={layout.isCompact} title="Notices" icon="megaphone" color="#3B82F6" bgColor="#EFF6FF" delay={200} onPress={() => navigation.navigate('TeacherNotifs')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={layout.isCompact} title="Directory" icon="people" color="#8B5CF6" bgColor="#F5F3FF" delay={300} onPress={() => navigation.navigate('Students')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={layout.isCompact} title="Routine" icon="calendar" color="#E11D48" bgColor="#FFE4E6" delay={400} onPress={() => navigation.navigate('Routine')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={layout.isCompact} title="Assignments" icon="document-text" color="#F59E0B" bgColor="#FFFBEB" delay={500} onPress={() => navigation.navigate('Assignments')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={layout.isCompact} title="Gallery" icon="images" color="#F97316" bgColor="#FFF7ED" delay={600} onPress={() => navigation.navigate('GalleryView')} />
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); logout(); }}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutBtnText}>Secure Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F5' },
  glassHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 80, zIndex: 100, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  glassHeaderContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 15 },
  glassTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: 0 },
  glassAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  glassAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { paddingBottom: 120 },
  scrollContentDesktop: { alignItems: 'center', paddingBottom: 80 },
  heroContainer: { height: 320, width: '100%', backgroundColor: '#0F172A' },
  heroContainerDesktop: { width: '100%', alignSelf: 'center', borderRadius: 28, overflow: 'hidden', marginTop: 24 },
  heroImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  heroGradient: { width: '100%', height: '100%', padding: 24, justifyContent: 'flex-end' },
  heroGradientDesktop: { padding: 36 },
  instituteHeading: { fontSize: 16, fontWeight: '700', color: '#DDD6FE', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  greetingBlock: { marginLeft: 16, flex: 1, minWidth: 0 },
  avatarFallback: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarInitials: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  avatarImage: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#fff' },
  greeting: { fontSize: 16, color: '#E2E8F0', fontWeight: '500' },
  greetingName: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 2, letterSpacing: 0 },
  pillContainer: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' },
  pillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginRight: 10 },
  pillText: { color: '#ffffff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  bodyContent: { padding: 20, marginTop: -20, backgroundColor: '#F4F4F5', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bodyContentDesktop: { width: '100%', alignSelf: 'center', marginTop: 18, borderRadius: 0, paddingHorizontal: 0 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 16, marginTop: 10, letterSpacing: 0 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridContainerDesktop: { alignContent: 'flex-start' },
  logoutBtn: { backgroundColor: '#fff', flexDirection: 'row', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2, marginTop: 10 },
  logoutBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});
