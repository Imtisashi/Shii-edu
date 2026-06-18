import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import DynamicHeader from '../../components/DynamicHeader';
import { SkeletonBlock } from '../../components/ui/LoadingState';
import { db } from '../../../firebaseConfig';
import { isFeatureEnabled } from '../../constants/featureEntitlements';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { useParentLinkedStudents } from '../../hooks/useParentLinkedStudents';
import { isNoticeForBroadcasts } from '../../utils/isNoticeForBroadcasts';

const TABS = [
  { icon: 'sunny-outline', key: 'today', label: 'Today' },
  { icon: 'people-outline', key: 'child', label: 'Children' },
  { icon: 'wallet-outline', key: 'fees', label: 'Fees' },
  { icon: 'help-buoy-outline', key: 'help', label: 'Help' },
];

const normalize = (value) => String(value || '').trim();
const normalizeLower = (value) => normalize(value).toLowerCase();
const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

const getStudentDisplayId = (student = {}) => (
  student.loginId ||
  student.uniqueId ||
  student.studentId ||
  student.id ||
  'Not shared yet'
);

const getClassLabel = (student = {}) => {
  const classValue = student.class || student.standard || student.dept || student.department;
  const sectionValue = student.section || student.sem || student.semester;
  return [classValue, sectionValue].filter(Boolean).join(' - ') || 'Not assigned yet';
};

const showPlainMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

function ParentSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <SkeletonBlock height={96} radius={10} width="100%" />
      <SkeletonBlock height={56} radius={8} width="100%" />
      <SkeletonBlock height={140} radius={10} width="100%" />
      <SkeletonBlock height={78} radius={8} width="100%" />
      <SkeletonBlock height={78} radius={8} width="100%" />
    </View>
  );
}

function ActionTile({ color, icon, label, onPress, subtitle }) {
  const { colors, radii } = useRootLayout();
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.actionTile,
        {
          backgroundColor: colors.cardStrong,
          borderColor: colors.hairline,
          borderRadius: radii.control,
        },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={21} color="#FFFFFF" />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
        <Text numberOfLines={2} style={[styles.actionSubtitle, { color: colors.textSoft }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

function InfoRow({ icon, label, value }) {
  const { colors } = useRootLayout();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.hairline }]}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={19} color={colors.accent} />
        <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      </View>
      <Text numberOfLines={2} style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ChildSwitcher({ selectedStudentId, setSelectedStudentId, students }) {
  const { colors, radii } = useRootLayout();
  if (!students || students.length <= 1) return null;

  return (
    <View style={[styles.childSwitcher, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.control }]}>
      <Text style={[styles.childSwitcherLabel, { color: colors.muted }]}>Choose child</Text>
      <View style={styles.childChipRow}>
        {students.map((item) => {
          const selected = item.id === selectedStudentId;
          return (
            <TouchableOpacity
              accessibilityLabel={`View ${item.name || getStudentDisplayId(item)}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => setSelectedStudentId(item.id)}
              style={[
                styles.childChip,
                {
                  backgroundColor: selected ? colors.text : colors.cardStrong,
                  borderColor: selected ? colors.text : colors.hairline,
                  borderRadius: radii.control,
                },
              ]}
            >
              <Text numberOfLines={1} style={[styles.childChipText, { color: selected ? colors.page : colors.textSoft }]}>
                {item.name || getStudentDisplayId(item)}
              </Text>
              <Text numberOfLines={1} style={[styles.childChipSubtext, { color: selected ? colors.page : colors.muted }]}>
                {getStudentDisplayId(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function ParentHome() {
  const navigation = useNavigation();
  const { logout, notifications, userData } = useAuth();
  const { instituteData } = useInstitution();
  const { brand, colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [activeTab, setActiveTab] = useState('today');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [feeInvoices, setFeeInvoices] = useState([]);
  const {
    loading: studentLoading,
    selectedStudent: student,
    selectedStudentId,
    setSelectedStudentId,
    students,
  } = useParentLinkedStudents(userData);
  const linkedStudentUserId = normalize(student?.loginId || student?.uniqueId || student?.studentId || userData?.linkedStudentUserId || userData?.studentId);

  const openScreen = useCallback((screen) => {
    const parentNavigation = navigation.getParent?.();
    (parentNavigation || navigation).navigate(screen);
  }, [navigation]);

  useEffect(() => {
    if (!student?.id || !userData?.instituteId) {
      setAttendanceRecords([]);
      return undefined;
    }

    const identifiers = [
      { field: 'studentUid', value: student.id },
      { field: 'studentId', value: student.loginId || student.uniqueId || linkedStudentUserId },
      { field: 'studentUniqueId', value: student.uniqueId || student.loginId || linkedStudentUserId },
    ]
      .filter((item) => item.value)
      .filter((item, index, items) => (
        items.findIndex((candidate) => candidate.field === item.field && candidate.value === item.value) === index
      ));
    const buckets = new Map();

    const unsubscribes = identifiers.map((item) => onSnapshot(
      query(
        collection(db, 'attendance'),
        where('instituteId', '==', userData.instituteId),
        where(item.field, '==', item.value)
      ),
      (snapshot) => {
        buckets.set(`${item.field}:${item.value}`, snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        const deduped = new Map();
        Array.from(buckets.values()).flat().forEach((record) => deduped.set(record.id, record));
        setAttendanceRecords(Array.from(deduped.values()));
      },
      (error) => {
        console.warn(`Parent attendance listener failed for ${item.field}:`, error);
        buckets.set(`${item.field}:${item.value}`, []);
        const deduped = new Map();
        Array.from(buckets.values()).flat().forEach((record) => deduped.set(record.id, record));
        setAttendanceRecords(Array.from(deduped.values()));
      }
    ));

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [linkedStudentUserId, student?.id, student?.loginId, student?.uniqueId, userData?.instituteId]);

  useEffect(() => {
    if (!student?.id || !userData?.instituteId) {
      setFeeInvoices([]);
      return undefined;
    }

    return onSnapshot(
      query(
        collection(db, 'feeInvoices'),
        where('instituteId', '==', userData.instituteId),
        where('studentUid', '==', student.id)
      ),
      (snapshot) => {
        setFeeInvoices(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
      },
      (error) => {
        console.warn('Parent fee invoice listener failed:', error);
        setFeeInvoices([]);
      }
    );
  }, [student?.id, userData?.instituteId]);

  const attendanceSummary = useMemo(() => {
    const present = attendanceRecords.filter((record) => (
      record.isPresent === true || ['present', 'late'].includes(normalizeLower(record.status))
    )).length;
    const total = attendanceRecords.length;
    return {
      percent: total ? Math.round((present / total) * 100) : null,
      present,
      total,
    };
  }, [attendanceRecords]);

  const feeSummary = useMemo(() => {
    if (feeInvoices.length > 0) {
      const total = feeInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
      const paid = feeInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
      return { pending: Math.max(0, total - paid), total };
    }
    const total = Number(student?.totalFee || 0);
    const paid = Number(student?.feePaid || 0);
    return { pending: Math.max(0, total - paid), total };
  }, [feeInvoices, student?.feePaid, student?.totalFee]);

  const latestNotices = useMemo(() => (notifications || [])
    .filter(isNoticeForBroadcasts)
    .slice(0, 3), [notifications]);
  const childName = student?.name || userData?.linkedStudentName || 'Linked student';
  const canUseFees = isFeatureEnabled(instituteData, 'finance');
  const canUseMessages = isFeatureEnabled(instituteData, 'messages');
  const canUseNotices = isFeatureEnabled(instituteData, 'notices');
  const canUseTransport = isFeatureEnabled(instituteData, 'transport');

  const openHelp = () => {
    if (canUseMessages) {
      openScreen('CommunicationHub');
      return;
    }
    showPlainMessage(
      'Ask the school office',
      `Share your Institute ID (${userData?.instituteId || 'not available'}) and Parent ID (${userData?.loginId || userData?.uniqueId || 'not available'}) with the office.`
    );
  };

  const renderPanel = () => {
    if (studentLoading) return <ParentSkeleton />;

    if (activeTab === 'today') {
      return (
        <>
          <View style={[styles.panel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Text style={[styles.panelKicker, { color: colors.accent }]}>Today</Text>
            <Text style={[styles.panelTitle, { color: colors.text }]}>Start here</Text>
            <Text style={[styles.panelText, { color: colors.textSoft }]}>
              {latestNotices.length > 0
                ? 'The school has shared updates for your account.'
                : 'No new school update is waiting right now.'}
            </Text>
          </View>

          {latestNotices.length > 0 ? latestNotices.map((notice, index) => (
            <TouchableOpacity
              activeOpacity={0.82}
              key={notice.id || `notice-${index}`}
              onPress={() => canUseNotices && openScreen('Notifications')}
              style={[styles.noticeCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.control }]}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.accent} />
              <View style={styles.noticeCopy}>
                <Text numberOfLines={1} style={[styles.noticeTitle, { color: colors.text }]}>{notice.title || 'School update'}</Text>
                <Text numberOfLines={2} style={[styles.noticeText, { color: colors.textSoft }]}>{notice.message || 'Open updates for details.'}</Text>
              </View>
            </TouchableOpacity>
          )) : null}

          <ActionTile
            color="#2563EB"
            icon={students.length > 1 ? 'people-outline' : 'person-outline'}
            label={students.length > 1 ? 'Check children' : 'Check my child'}
            onPress={() => setActiveTab('child')}
            subtitle={`Student: ${childName}`}
          />
          {canUseFees ? (
            <ActionTile
              color="#B45309"
              icon="wallet-outline"
              label="See fees"
              onPress={() => setActiveTab('fees')}
              subtitle={feeSummary.total > 0 ? `${formatCurrency(feeSummary.pending)} remaining` : 'No fee dues shared yet'}
            />
          ) : null}
        </>
      );
    }

    if (activeTab === 'child') {
      return (
        <View style={[styles.panel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
        <Text style={[styles.panelKicker, { color: colors.accent }]}>{students.length > 1 ? 'Selected Child' : 'My Child'}</Text>
          <Text style={[styles.panelTitle, { color: colors.text }]}>{childName}</Text>
          <InfoRow icon="card-outline" label="Student ID" value={getStudentDisplayId(student || {})} />
          <InfoRow icon="school-outline" label="Class" value={getClassLabel(student || {})} />
          <InfoRow
            icon="calendar-outline"
            label="Attendance"
            value={attendanceSummary.percent === null ? 'Not shared yet' : `${attendanceSummary.percent}% from ${attendanceSummary.total} marked classes`}
          />
          {canUseTransport ? (
            <ActionTile
              color="#047857"
              icon="bus-outline"
              label="Route information"
              onPress={() => openScreen('Live Fleet')}
              subtitle="Open the assigned school transport view"
            />
          ) : null}
        </View>
      );
    }

    if (activeTab === 'fees') {
      return (
        <View style={[styles.panel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.panelKicker, { color: colors.bronze }]}>Fees</Text>
          <Text style={[styles.panelTitle, { color: colors.text }]}>{feeSummary.total > 0 ? formatCurrency(feeSummary.pending) : 'No dues shared yet'}</Text>
          <Text style={[styles.panelText, { color: colors.textSoft }]}>
            {feeSummary.total > 0
              ? `Total assigned fees are ${formatCurrency(feeSummary.total)}. Open the fee page to see receipts and payment options.`
              : 'When the school assigns fees, they will appear here in simple language.'}
          </Text>
          {canUseFees ? (
            <ActionTile
              color="#B45309"
              icon="receipt-outline"
              label="Open fee details"
              onPress={() => openScreen('Fee Payment')}
              subtitle="View itemized dues, receipts, and payment status"
            />
          ) : null}
        </View>
      );
    }

    return (
      <View style={[styles.panel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
        <Text style={[styles.panelKicker, { color: colors.accent }]}>Help</Text>
        <Text style={[styles.panelTitle, { color: colors.text }]}>Need the school office?</Text>
        <Text style={[styles.panelText, { color: colors.textSoft }]}>
          Use this when login, fees, notices, or student details are confusing. The office can check your parent link from the admin support desk.
        </Text>
        <ActionTile
          color="#2563EB"
          icon={canUseMessages ? 'chatbubbles-outline' : 'call-outline'}
          label={canUseMessages ? 'Message the school' : 'Show office details'}
          onPress={openHelp}
          subtitle={canUseMessages ? 'Send a message from your parent account' : 'Use your Institute ID and Parent ID at the office'}
        />
        {canUseNotices ? (
          <ActionTile
            color="#7C3AED"
            icon="notifications-outline"
            label="Open school updates"
            onPress={() => openScreen('Notifications')}
            subtitle="Read messages and reminders from the institute"
          />
        ) : null}
        </View>
      );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Home" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            maxWidth: maxContentWidth,
            paddingBottom: spacing.xxl,
            paddingHorizontal: spacing.pageX,
            paddingTop: spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.accent }]}>Parent home</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Hello, {userData?.name || 'Parent'}</Text>
            <Text style={[styles.heroText, { color: colors.textSoft }]}>
              {brand.name || userData?.instituteData?.name || 'Your institute'} keeps this page simple: what matters today, your child, fees, and help.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={logout}
            style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: colors.hairline }]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.warning} />
            <Text style={[styles.logoutText, { color: colors.warning }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <ChildSwitcher
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
          students={students}
        />

        <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.control }]}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <TouchableOpacity
                activeOpacity={0.84}
                accessibilityRole="button"
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabButton,
                  selected && { backgroundColor: colors.text },
                ]}
              >
                <Ionicons name={tab.icon} size={17} color={selected ? colors.page : colors.textSoft} />
                <Text style={[styles.tabText, { color: selected ? colors.page : colors.textSoft }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {renderPanel()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  actionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  actionTile: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    minHeight: 76,
    padding: 13,
  },
  childChip: {
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 54,
    minWidth: 132,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  childChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  childChipSubtext: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  childChipText: {
    fontSize: 13,
    fontWeight: '900',
  },
  childSwitcher: {
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  childSwitcherLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  hero: {
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 7,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 30,
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  infoRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingVertical: 10,
  },
  infoRowLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    marginLeft: 12,
    textAlign: 'right',
  },
  logoutButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 11,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '900',
  },
  noticeCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: 12,
    minHeight: 72,
    padding: 13,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  panel: {
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  panelKicker: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  panelText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
    marginTop: 5,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    width: '100%',
  },
  skeletonWrap: {
    gap: 12,
    marginTop: 14,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 6,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '900',
  },
  tabs: {
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 12,
    padding: 5,
  },
});
