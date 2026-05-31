import React, { useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ImageBackground, Animated, Platform, StatusBar 
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import PremiumActionCard from '../../components/ui/PremiumActionCard';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function AdminHome() {
  const navigation = useNavigation();
  const { userData, logout } = useAuth();
  const layout = useResponsiveLayout();

  const scrollY = useRef(new Animated.Value(0)).current;

  const adminName = userData?.name || "Administrator";
  const initials = adminName.charAt(0).toUpperCase();
  const instituteName = userData?.instituteData?.name || "Shii Edu";
  const isSchool = userData?.instituteData?.type?.toLowerCase().includes('school');
  const firstName = adminName.split(' ')[0];
  const compactCards = layout.isMobile;

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Animated.View pointerEvents="none" style={[styles.glassHeader, { opacity: headerOpacity }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.95)' }]} />
        )}
        <View style={styles.glassHeaderContent}>
          <Text style={styles.glassTitle}>Admin Command</Text>
          <View style={[styles.glassAvatar, { backgroundColor: '#1E293B' }]}>
            <Text style={styles.glassAvatarText}>{initials}</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: USE_NATIVE_DRIVER })}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, layout.isDesktop && styles.scrollContentDesktop]}
      >
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
            source={{ uri: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1000&auto=format&fit=crop' }}             style={styles.heroImage}
           >
             <View style={[styles.heroGradient, layout.isMobile && styles.heroGradientMobile, layout.isDesktop && styles.heroGradientDesktop, { backgroundColor: 'rgba(15, 23, 42, 0.85)' }]}>
               <Text style={[styles.instituteHeading, layout.isMobile && styles.instituteHeadingMobile]} numberOfLines={1}>{instituteName}</Text>
               <View style={[styles.profileRow, layout.isMobile && styles.profileRowMobile]}>
                  <View style={[styles.avatarFallback, layout.isMobile && styles.avatarFallbackMobile]}><Text style={[styles.avatarInitials, layout.isMobile && styles.avatarInitialsMobile]}>{initials}</Text></View>
                  <View style={styles.greetingBlock}>
                    <Text style={[styles.greeting, layout.isMobile && styles.greetingMobile]}>Command Center,</Text>
                    <Text style={[styles.greetingName, layout.isMobile && styles.greetingNameMobile]} numberOfLines={1}>{firstName}</Text>
                  </View>
               </View>
               
               <View style={[styles.pillContainer, layout.isMobile && styles.pillContainerMobile]}>
                 <View style={[styles.pillBadge, layout.isMobile && styles.pillBadgeMobile, {backgroundColor: 'rgba(59, 130, 246, 0.3)', borderColor: '#3B82F6'}]}>
                    <Ionicons name="shield-checkmark" size={12} color="#fff" style={{marginRight: 4}} />
                    <Text style={[styles.pillText, layout.isMobile && styles.pillTextMobile]} numberOfLines={1}>Root Access</Text>
                 </View>
                 <View style={[styles.pillBadge, layout.isMobile && styles.pillBadgeMobile]}>
                    <Text style={[styles.pillText, layout.isMobile && styles.pillTextMobile]} numberOfLines={1}>{isSchool ? 'School Campus' : 'College Campus'}</Text>
                 </View>
               </View>
             </View>
           </ImageBackground>
        </Animated.View>

        <View style={[styles.bodyContent, layout.isMobile && styles.bodyContentMobile, layout.isDesktop && styles.bodyContentDesktop, layout.isDesktop && { maxWidth: layout.maxContentWidth }]}>
          <Text style={[styles.sectionTitle, layout.isMobile && styles.sectionTitleMobile]}>Platform Controls</Text>
          
          <View style={[styles.gridContainer, layout.isDesktop && styles.gridContainerDesktop]}>
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Students" icon="people" color="#3B82F6" bgColor="#EFF6FF" delay={100} onPress={() => navigation.navigate('Users')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Faculty" icon="briefcase" color="#8B5CF6" bgColor="#F5F3FF" delay={200} onPress={() => navigation.navigate('ManageTeachers')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title={layout.isMobile ? 'Routine' : 'Master Routine'} icon="calendar" color="#E11D48" bgColor="#FFE4E6" delay={300} onPress={() => navigation.navigate('ManageRoutines')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Revenue" icon="wallet" color="#10B981" bgColor="#ECFDF5" delay={400} onPress={() => navigation.navigate('Ledger')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Broadcast" icon="megaphone" color="#F59E0B" bgColor="#FFFBEB" delay={500} onPress={() => navigation.navigate('Broadcasts')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Calendar" icon="calendar-number" color="#64748B" bgColor="#F1F5F9" delay={600} onPress={() => navigation.navigate('ManageHolidays')} />
          </View>

          <TouchableOpacity style={[styles.logoutBtn, layout.isMobile && styles.logoutBtnMobile]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); logout(); }}>
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
  scrollView: { flex: 1 },
  glassHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 80, zIndex: 100, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  glassHeaderContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 15 },
  glassTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: 0 },
  glassAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  glassAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { paddingBottom: 120 },
  scrollContentDesktop: { alignItems: 'center', paddingBottom: 80 },
  heroContainer: { height: 320, width: '100%', backgroundColor: '#0F172A' },
  heroContainerDesktop: { width: '100%', alignSelf: 'center', borderRadius: 28, overflow: 'hidden', marginTop: 24 },
  heroImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  heroGradient: { width: '100%', height: '100%', padding: 24, justifyContent: 'flex-end' },
  heroGradientDesktop: { padding: 36 },
  heroGradientMobile: { padding: 18 },
  instituteHeading: { fontSize: 16, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 },
  instituteHeadingMobile: { fontSize: 12, lineHeight: 16, marginBottom: 14, letterSpacing: 1 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileRowMobile: { marginBottom: 12 },
  greetingBlock: { marginLeft: 16, flex: 1, minWidth: 0 },
  avatarFallback: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarFallbackMobile: { width: 56, height: 56, borderRadius: 28 },
  avatarInitials: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  avatarInitialsMobile: { fontSize: 22 },
  greeting: { fontSize: 16, color: '#94A3B8', fontWeight: '500' },
  greetingMobile: { fontSize: 13 },
  greetingName: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 2, letterSpacing: 0 },
  greetingNameMobile: { fontSize: 25, lineHeight: 30 },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  pillContainerMobile: { marginTop: 2 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginRight: 10 },
  pillBadgeMobile: { paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  pillText: { color: '#ffffff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  pillTextMobile: { fontSize: 12, letterSpacing: 0.2 },
  bodyContent: { padding: 20, marginTop: -20, backgroundColor: '#F4F4F5', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bodyContentMobile: { paddingHorizontal: 16, paddingTop: 18 },
  bodyContentDesktop: { width: '100%', alignSelf: 'center', marginTop: 18, borderRadius: 0, paddingHorizontal: 0 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 16, marginTop: 10, letterSpacing: 0 },
  sectionTitleMobile: { fontSize: 18, marginBottom: 12 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridContainerDesktop: { alignContent: 'flex-start' },
  logoutBtn: { backgroundColor: '#fff', flexDirection: 'row', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2, marginTop: 10 },
  logoutBtnMobile: { padding: 16, borderRadius: 17 },
  logoutBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});
