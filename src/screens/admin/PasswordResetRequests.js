import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import {
  approvePasswordResetRequest,
  listPasswordResetRequests,
  rejectPasswordResetRequest,
} from '../../services/passwordResetService';
import { showPwaNotification } from '../../services/pwaNotificationService';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const STATUS_META = {
  approved: { color: '#047857', icon: 'checkmark-circle-outline', label: 'Approved' },
  pending: { color: '#B45309', icon: 'time-outline', label: 'Pending' },
  rejected: { color: '#DC2626', icon: 'close-circle-outline', label: 'Rejected' },
};

const formatRole = (role) => {
  if (role === 'parent') return 'Parents';
  if (role === 'driver') return 'Driver';
  return 'Institute';
};

const formatDate = (value) => {
  if (!value) return 'Time pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time pending';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
};

export default function PasswordResetRequests() {
  const { currentUser } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [actionId, setActionId] = useState('');
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});
  const [requests, setRequests] = useState([]);

  const loadRequests = useCallback(async ({ quiet = false } = {}) => {
    if (!currentUser) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const nextRequests = await listPasswordResetRequests(currentUser, filter);
      setRequests(nextRequests);
    } catch (error) {
      showNativeError('Reset Queue Failed', error, 'Password reset requests could not be loaded.');
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, filter]);

  useEffect(() => {
    loadRequests();
    const intervalId = setInterval(() => {
      loadRequests({ quiet: true });
    }, 30000);
    return () => clearInterval(intervalId);
  }, [loadRequests]);

  const summary = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending').length;
    const approved = requests.filter((request) => request.status === 'approved').length;
    const rejected = requests.filter((request) => request.status === 'rejected').length;

    return {
      approved,
      pending,
      rejected,
      total: requests.length,
    };
  }, [requests]);

  const handleApprove = async (request) => {
    setActionId(request.id);
    try {
      await approvePasswordResetRequest(currentUser, request.id);
      showNativeMessage('Reset Approved', `${request.userName || request.userId} can now open the reset link from login.`);
      await showPwaNotification({
        body: 'The requester can now open their reset link from the login screen.',
        tag: `admin-approved-reset-${request.id}`,
        title: 'Password reset approved',
        url: '/auth/institute',
      }).catch(() => false);
      await loadRequests({ quiet: true });
    } catch (error) {
      showNativeError('Approval Failed', error, 'The password reset request could not be approved.');
    } finally {
      setActionId('');
    }
  };

  const handleReject = async (request) => {
    setActionId(request.id);
    try {
      await rejectPasswordResetRequest(
        currentUser,
        request.id,
        rejectReasons[request.id] || 'The institute administrator rejected this reset request.'
      );
      showNativeMessage('Reset Rejected', `${request.userName || request.userId} reset request has been closed.`);
      await loadRequests({ quiet: true });
    } catch (error) {
      showNativeError('Rejection Failed', error, 'The password reset request could not be rejected.');
    } finally {
      setActionId('');
    }
  };

  const renderRequest = (request) => {
    const status = STATUS_META[request.status] || STATUS_META.pending;
    const busy = actionId === request.id;

    return (
      <View
        key={request.id}
        style={[styles.requestCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestIdentity}>
            <View style={[styles.avatar, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Ionicons color={status.color} name={status.icon} size={22} />
            </View>
            <View style={styles.requestCopy}>
              <Text numberOfLines={1} style={[styles.requestTitle, { color: colors.text }]}>
                {request.userName || request.userId}
              </Text>
              <Text numberOfLines={1} style={[styles.requestMeta, { color: colors.textSoft }]}>
                {formatRole(request.role)} / {request.userId}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={[styles.detailGrid, { borderTopColor: colors.hairline }]}>
          <View style={styles.detailCell}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Requested</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(request.createdAt)}</Text>
          </View>
          <View style={styles.detailCell}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Contact</Text>
            <Text numberOfLines={1} style={[styles.detailValue, { color: colors.text }]}>
              {request.contact || 'No contact detail'}
            </Text>
          </View>
        </View>

        {request.note ? (
          <View style={[styles.noteBox, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
            <Text style={[styles.noteText, { color: colors.textSoft }]}>{request.note}</Text>
          </View>
        ) : null}

        {request.status === 'pending' ? (
          <>
            <TextInput
              onChangeText={(value) => setRejectReasons((current) => ({ ...current, [request.id]: value }))}
              placeholder="Optional rejection reason"
              placeholderTextColor={colors.muted}
              style={[styles.rejectInput, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
              value={rejectReasons[request.id] || ''}
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={busy}
                onPress={() => handleApprove(request)}
                style={[styles.approveButton, busy && styles.disabled]}
              >
                {busy ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name="checkmark-outline" size={18} />}
                <Text style={styles.primaryButtonText}>Approve reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={busy}
                onPress={() => handleReject(request)}
                style={[styles.rejectButton, busy && styles.disabled]}
              >
                <Ionicons color="#DC2626" name="close-outline" size={18} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={[styles.closedText, { color: colors.textSoft }]}>
            {request.status === 'approved'
              ? 'A secure reset link has been issued to the requester on the login page.'
              : request.rejectedReason || 'This reset request was rejected.'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.page }]}
    >
      <DynamicHeader showBack title="Password Resets" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingHorizontal: spacing.pageX,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryCopy}>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>Credential recovery</Text>
              <Text style={[styles.title, { color: colors.text }]}>Admin-approved password resets</Text>
              <Text style={[styles.subtitle, { color: colors.textSoft }]}>
                Review requests from Institute, Parents, and Driver login screens before a reset link is released.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.84}
              disabled={refreshing}
              onPress={() => loadRequests({ quiet: true })}
              style={[styles.refreshButton, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}
            >
              <Ionicons color={colors.text} name={refreshing ? 'sync-outline' : 'refresh-outline'} size={19} />
            </TouchableOpacity>
          </View>

          <View style={styles.metricGrid}>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Pending</Text>
              <Text style={[styles.metricValue, { color: STATUS_META.pending.color }]}>{summary.pending}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Approved</Text>
              <Text style={[styles.metricValue, { color: STATUS_META.approved.color }]}>{summary.approved}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Rejected</Text>
              <Text style={[styles.metricValue, { color: STATUS_META.rejected.color }]}>{summary.rejected}</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller}>
          <View style={styles.filterRow}>
            {FILTERS.map((item) => {
              const selected = filter === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.84}
                  key={item.id}
                  onPress={() => setFilter(item.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? colors.deepBlue : colors.cardStrong,
                      borderColor: selected ? colors.deepBlue : colors.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : colors.textSoft }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {loading ? (
          <RosterSkeleton rowCount={4} showFilters={false} />
        ) : requests.length === 0 ? (
          <View style={[styles.emptyPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Ionicons color={colors.muted} name="key-outline" size={32} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No reset requests</Text>
            <Text style={[styles.emptyText, { color: colors.textSoft }]}>
              New password reset requests will appear here after users submit them from login.
            </Text>
          </View>
        ) : (
          <View style={styles.requestList}>{requests.map(renderRequest)}</View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveButton: { alignItems: 'center', backgroundColor: '#047857', borderRadius: 8, flex: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 48 },
  avatar: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', marginRight: 11, width: 44 },
  closedText: { fontSize: 12, fontWeight: '800', lineHeight: 18, marginTop: 12 },
  content: { alignSelf: 'center', paddingBottom: 90, paddingTop: 16, width: '100%' },
  detailCell: { flex: 1, minWidth: 120 },
  detailGrid: { borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13, paddingTop: 12 },
  detailLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  disabled: { opacity: 0.66 },
  emptyPanel: { alignItems: 'center', borderWidth: 1, padding: 24 },
  emptyText: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 7, textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  filterChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  filterScroller: { marginBottom: 14 },
  filterText: { fontSize: 12, fontWeight: '900' },
  metricCell: { borderRadius: 8, borderWidth: 1, flex: 1, minWidth: 112, padding: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metricLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  noteBox: { borderRadius: 8, borderWidth: 1, marginTop: 12, padding: 11 },
  noteText: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 8 },
  refreshButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', marginLeft: 12, width: 42 },
  rejectButton: { alignItems: 'center', backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 48 },
  rejectButtonText: { color: '#DC2626', fontSize: 13, fontWeight: '900', marginLeft: 8 },
  rejectInput: { borderRadius: 8, borderWidth: 1, fontSize: 13, fontWeight: '700', minHeight: 44, outlineStyle: 'none', paddingHorizontal: 12, marginTop: 12 },
  requestCard: { borderWidth: 1, padding: 14 },
  requestCopy: { flex: 1, minWidth: 0 },
  requestHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  requestIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', minWidth: 0 },
  requestList: { gap: 10 },
  requestMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  requestTitle: { fontSize: 15, fontWeight: '900' },
  screen: { flex: 1, overflow: 'hidden' },
  statusDot: { borderRadius: 4, height: 7, marginRight: 6, width: 7 },
  statusPill: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginLeft: 10, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryPanel: { borderWidth: 1, marginBottom: 12, padding: 16 },
  title: { fontSize: 21, fontWeight: '900', marginTop: 3 },
});
