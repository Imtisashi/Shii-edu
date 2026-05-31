import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ImageBackground, Animated, Platform, Image, StatusBar 
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import PremiumActionCard from '../../components/ui/PremiumActionCard';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const ENABLE_SCROLL_MOTION = Platform.OS !== 'web';

export default function StudentHome() {
  const navigation = useNavigation();
  const { userData, logout } = useAuth();
  const layout = useResponsiveLayout();
  const [notices, setNotices] = useState([]);

  // Enterprise Scroll Animation Values
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!userData?.instituteId) return;
    const q = query(collection(db, "notices"), where("instituteId", "==", userData.instituteId), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [userData]);

  const studentName = userData?.name || "Student";
  const initials = studentName.charAt(0).toUpperCase();
  const instituteName = userData?.instituteData?.name || "Shii Edu";
  const compactCards = layout.isMobile;
  
  const instTypeStr = (userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = instTypeStr.includes('school');
  const p1 = isSchool ? `Class ${userData?.class || 'N/A'}` : (userData?.dept || 'N/A');
  const p2 = isSchool ? `Sec ${userData?.section || 'N/A'}` : `Sem ${userData?.sem || 'N/A'}`;
  const recentNotices = notices.slice(0, 3);

  // Interpolations for Parallax & Glass Header
  const headerOpacity = ENABLE_SCROLL_MOTION ? scrollY.interpolate({
    inputRange: [50, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }) : 0;

  const heroTranslateY = ENABLE_SCROLL_MOTION ? scrollY.interpolate({
    inputRange: [-100, 0, 200],
    outputRange: [0, 0, 100],
    extrapolate: 'clamp',
  }) : 0;

  const heroScale = ENABLE_SCROLL_MOTION ? scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  }) : 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* STICKY GLASSMORPHISM HEADER */}
      <Animated.View pointerEvents="none" style={[styles.glassHeader, { opacity: headerOpacity }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.95)' }]} />
        )}
        <View style={styles.glassHeaderContent}>
          <Text style={styles.glassTitle}>{instituteName}</Text>
          <View style={styles.glassAvatar}>
            <Text style={styles.glassAvatarText}>{initials}</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        onScroll={ENABLE_SCROLL_MOTION ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: USE_NATIVE_DRIVER }) : undefined}
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
            ENABLE_SCROLL_MOTION && { transform: [{ translateY: heroTranslateY }, { scale: heroScale }] },
          ]}
        >
           <ImageBackground 
            source={{ uri: userData?.instituteData?.heroImage || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1000&auto=format&fit=crop' }}             style={styles.heroImage}
           >
             <View style={[styles.heroGradient, layout.isMobile && styles.heroGradientMobile, layout.isDesktop && styles.heroGradientDesktop]}>
               <Text style={[styles.instituteHeading, layout.isMobile && styles.instituteHeadingMobile]} numberOfLines={1}>{instituteName}</Text>
               <View style={[styles.profileRow, layout.isMobile && styles.profileRowMobile]}>
                  {userData?.profilePic ? (
                    <Image source={{ uri: userData.profilePic }} style={[styles.avatarImage, layout.isMobile && styles.avatarImageMobile]} />
                  ) : (
                    <View style={[styles.avatarFallback, layout.isMobile && styles.avatarFallbackMobile]}><Text style={[styles.avatarInitials, layout.isMobile && styles.avatarInitialsMobile]}>{initials}</Text></View>
                  )}
                  <View style={styles.greetingBlock}>
                    <Text style={[styles.greeting, layout.isMobile && styles.greetingMobile]}>Welcome back,</Text>
                    <Text style={[styles.greetingName, layout.isMobile && styles.greetingNameMobile]} numberOfLines={1}>{studentName}</Text>
                  </View>
               </View>
               
               <View style={[styles.pillContainer, layout.isMobile && styles.pillContainerMobile]}>
                 <View style={[styles.pillBadge, layout.isMobile && styles.pillBadgeMobile]}><Text style={[styles.pillText, layout.isMobile && styles.pillTextMobile]} numberOfLines={1}>{p1}</Text></View>
                 <View style={[styles.pillBadge, layout.isMobile && styles.pillBadgeMobile]}><Text style={[styles.pillText, layout.isMobile && styles.pillTextMobile]} numberOfLines={1}>{p2}</Text></View>
               </View>
             </View>
           </ImageBackground>
        </Animated.View>

        <View style={[styles.bodyContent, layout.isMobile && styles.bodyContentMobile, layout.isDesktop && styles.bodyContentDesktop, layout.isDesktop && { maxWidth: layout.maxContentWidth }]}>
          <Text style={[styles.sectionTitle, layout.isMobile && styles.sectionTitleMobile]}>Dashboard</Text>
          
          <View style={[styles.gridContainer, layout.isDesktop && styles.gridContainerDesktop]}>
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Grades" icon="school" color="#8B5CF6" bgColor="#F5F3FF" delay={100} onPress={() => navigation.navigate('Grades')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Attendance" icon="bar-chart" color="#10B981" bgColor="#ECFDF5" delay={200} onPress={() => navigation.navigate('AttendanceView')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title={layout.isMobile ? 'Fees' : 'Fee Ledger'} icon="wallet" color="#F59E0B" bgColor="#FFFBEB" delay={300} onPress={() => navigation.navigate('FeePayment')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Routine" icon="calendar" color="#E11D48" bgColor="#FFE4E6" delay={400} onPress={() => navigation.navigate('Routine')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="PYQs" icon="document-text" color="#3B82F6" bgColor="#EFF6FF" delay={500} onPress={() => navigation.navigate('PYQView')} />
            <PremiumActionCard columns={layout.dashboardColumns} compact={compactCards} title="Gallery" icon="images" color="#F97316" bgColor="#FFF7ED" delay={600} onPress={() => navigation.navigate('GalleryView')} />
          </View>

          <Text style={[styles.sectionTitle, layout.isMobile && styles.sectionTitleMobile]}>Recent Broadcasts</Text>
          <View style={[styles.noticeContainer, layout.isMobile && styles.noticeContainerMobile]}>
            {notices.length === 0 ? (
              <Text style={styles.emptyNotices}>No recent announcements.</Text>
            ) : (
              recentNotices.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.miniNotice, index === recentNotices.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    navigation.navigate('MainTabs', { screen: 'Notices' });
                  }}
                  accessibilityLabel={`Open notice ${item.title || 'details'}`}
                >
                  <View style={styles.noticeIconCage}>
                    <Ionicons name="notifications" size={16} color="#3B82F6" />
                  </View>
                  <View style={styles.noticeTextBlock}>
                    <Text style={styles.miniNoticeTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.miniNoticeMeta}>{item.author || 'Campus'} - {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E0" />
                </TouchableOpacity>
              ))
            )}
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
  container: { flex: 1, backgroundColor: '#F4F4F5' }, // Enterprise subtle gray
  scrollView: { flex: 1 },
  
  // Glass Header
  glassHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 80, zIndex: 100, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  glassHeaderContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 15 },
  glassTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: 0 },
  glassAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  glassAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  scrollContent: { paddingBottom: 120 },
  scrollContentDesktop: { alignItems: 'center', paddingBottom: 80 },
  
  // Parallax Hero
  heroContainer: { height: 320, width: '100%', backgroundColor: '#0F172A' },
  heroContainerDesktop: { width: '100%', alignSelf: 'center', borderRadius: 28, overflow: 'hidden', marginTop: 24 },
  heroImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  heroGradient: { backgroundColor: 'rgba(0,0,0,0.6)', width: '100%', height: '100%', padding: 24, justifyContent: 'flex-end' },
  heroGradientDesktop: { padding: 36 },
  heroGradientMobile: { padding: 18 },
  instituteHeading: { fontSize: 16, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 },
  instituteHeadingMobile: { fontSize: 12, lineHeight: 16, marginBottom: 14, letterSpacing: 1 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileRowMobile: { marginBottom: 12 },
  greetingBlock: { marginLeft: 16, flex: 1, minWidth: 0 },
  avatarFallback: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarFallbackMobile: { width: 56, height: 56, borderRadius: 28 },
  avatarInitials: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  avatarInitialsMobile: { fontSize: 22 },
  avatarImage: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#fff' },
  avatarImageMobile: { width: 56, height: 56, borderRadius: 28 },
  greeting: { fontSize: 16, color: '#E2E8F0', fontWeight: '500' },
  greetingMobile: { fontSize: 13 },
  greetingName: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 2, letterSpacing: 0 },
  greetingNameMobile: { fontSize: 24, lineHeight: 30 },
  
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  pillContainerMobile: { marginTop: 2 },
  pillBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginRight: 10 },
  pillBadgeMobile: { paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  pillText: { color: '#ffffff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  pillTextMobile: { fontSize: 12, letterSpacing: 0.2 },
  
  // Body
  bodyContent: { padding: 20, marginTop: -20, backgroundColor: '#F4F4F5', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bodyContentMobile: { paddingHorizontal: 16, paddingTop: 18 },
  bodyContentDesktop: { width: '100%', alignSelf: 'center', marginTop: 18, borderRadius: 0, paddingHorizontal: 0 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 16, marginTop: 10, letterSpacing: 0 },
  sectionTitleMobile: { fontSize: 18, marginBottom: 12 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridContainerDesktop: { alignContent: 'flex-start' },
  
  // Notices
  noticeContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.03, shadowRadius: 15, marginBottom: 30 },
  noticeContainerMobile: { borderRadius: 18, padding: 12 },
  miniNotice: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  noticeIconCage: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  noticeTextBlock: { flex: 1, minWidth: 0 },
  miniNoticeTitle: { fontWeight: '700', fontSize: 15, color: '#1E293B', marginBottom: 4 },
  miniNoticeMeta: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  emptyNotices: { color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

  logoutBtn: { backgroundColor: '#fff', flexDirection: 'row', padding: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  logoutBtnMobile: { padding: 16, borderRadius: 17 },
  logoutBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});
