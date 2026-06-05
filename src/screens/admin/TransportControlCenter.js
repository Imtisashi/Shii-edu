import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
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
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';

const ROUTE_STATUSES = [
  { color: '#047857', id: 'active', label: 'Active' },
  { color: '#B45309', id: 'paused', label: 'Paused' },
  { color: '#BE123C', id: 'maintenance', label: 'Maintenance' },
];

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const normalizeRouteStatus = (status) => {
  const normalized = String(status || 'active').toLowerCase();
  return ROUTE_STATUSES.some((entry) => entry.id === normalized) ? normalized : 'active';
};
const getDriverId = (driver) => driver?.loginId || driver?.uniqueId || driver?.driverCode || driver?.id || 'ID pending';

export default function TransportControlCenter() {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeDestination, setRouteDestination] = useState('');
  const [routeShift, setRouteShift] = useState('');
  const [routeStatus, setRouteStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userData?.instituteId) {
      setDrivers([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const usersQuery = query(
      collection(db, 'users'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const driverList = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => normalizeRole(entry.role) === 'driver')
          .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
        setDrivers(driverList);
        setLoading(false);
      },
      (error) => {
        console.error('Transport driver query failed:', error);
        setDrivers([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userData?.instituteId]);

  const summary = useMemo(() => {
    const assigned = drivers.filter((driver) => driver.vehicleId && driver.routeName).length;
    const active = drivers.filter((driver) => String(driver.routeStatus || 'active') === 'active' && driver.vehicleId).length;
    const destinations = new Set(drivers.map((driver) => String(driver.routeDestination || '').trim()).filter(Boolean));

    return {
      active,
      assigned,
      destinations: destinations.size,
      unassigned: Math.max(drivers.length - assigned, 0),
    };
  }, [drivers]);

  const selectDriver = (driver) => {
    setSelectedDriver(driver);
    setVehicleId(String(driver?.vehicleId || ''));
    setRouteName(String(driver?.routeName || ''));
    setRouteDestination(String(driver?.routeDestination || ''));
    setRouteShift(String(driver?.routeShift || ''));
    setRouteStatus(normalizeRouteStatus(driver?.routeStatus));
  };

  const handleSaveRoute = async () => {
    Keyboard.dismiss();
    if (!selectedDriver) {
      showNativeMessage('Select Driver', 'Choose a driver before assigning route controls.');
      return;
    }

    const trimmedVehicleId = vehicleId.trim();
    const trimmedRouteName = routeName.trim();
    const trimmedDestination = routeDestination.trim();

    if (!trimmedVehicleId || !trimmedRouteName || !trimmedDestination) {
      showNativeMessage('Incomplete Route', 'Vehicle ID, route name, and destination are required.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', selectedDriver.id), {
        routeAssignedAt: serverTimestamp(),
        routeAssignedBy: currentUser?.uid || userData?.uid || null,
        routeDestination: trimmedDestination,
        routeName: trimmedRouteName,
        routeShift: routeShift.trim(),
        routeStatus,
        transportControl: {
          assignedAt: serverTimestamp(),
          assignedBy: currentUser?.uid || userData?.uid || null,
          destination: trimmedDestination,
          routeName: trimmedRouteName,
          shift: routeShift.trim(),
          status: routeStatus,
          vehicleId: trimmedVehicleId,
        },
        vehicleId: trimmedVehicleId,
      });
      showNativeMessage('Route Updated', `${selectedDriver.name || 'Driver'} is assigned to ${trimmedRouteName}.`);
      setSelectedDriver(null);
      setVehicleId('');
      setRouteName('');
      setRouteDestination('');
      setRouteShift('');
      setRouteStatus('active');
    } catch (error) {
      showNativeError('Route Update Failed', error, 'The route assignment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.page }]}
    >
      <DynamicHeader showBack title="Transport Control" />

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
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>Transport operations</Text>
              <Text style={[styles.title, { color: colors.text }]}>Routes, destinations, and drivers</Text>
              <Text style={[styles.subtitle, { color: colors.textSoft }]}>Assign route details once and the driver PWA reads the same profile fields.</Text>
            </View>
            <View style={[styles.summaryIcon, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
              <Ionicons color={colors.emerald} name="bus-outline" size={25} />
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Assigned</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>{summary.assigned}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Live-ready</Text>
              <Text style={[styles.metricValue, { color: colors.emerald }]}>{summary.active}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
              <Text style={[styles.metricLabel, { color: colors.muted }]}>Destinations</Text>
              <Text style={[styles.metricValue, { color: colors.warning }]}>{summary.destinations}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Assign driver to route</Text>
          <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Driver</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.driverStrip}>
            {drivers.map((driver) => {
              const selected = selectedDriver?.id === driver.id;
              return (
                <TouchableOpacity
                  key={driver.id}
                  onPress={() => selectDriver(driver)}
                  style={[
                    styles.driverChip,
                    {
                      backgroundColor: selected ? colors.emeraldSoft : colors.card,
                      borderColor: selected ? colors.emerald : colors.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.driverChipText, { color: selected ? colors.emerald : colors.textSoft }]}>
                    {driver.name || getDriverId(driver)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Vehicle ID</Text>
              <TextInput
                autoCapitalize="characters"
                onChangeText={setVehicleId}
                placeholder="e.g. BUS-04"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={vehicleId}
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Route name</Text>
              <TextInput
                onChangeText={setRouteName}
                placeholder="e.g. North Route"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeName}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Destination</Text>
              <TextInput
                onChangeText={setRouteDestination}
                placeholder="e.g. Central Campus Gate"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeDestination}
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Shift</Text>
              <TextInput
                onChangeText={setRouteShift}
                placeholder="e.g. Morning"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeShift}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Route status</Text>
          <View style={styles.statusRow}>
            {ROUTE_STATUSES.map((status) => {
              const selected = routeStatus === status.id;
              return (
                <TouchableOpacity
                  key={status.id}
                  onPress={() => setRouteStatus(status.id)}
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: selected ? status.color : colors.card,
                      borderColor: selected ? status.color : colors.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.statusButtonText, { color: selected ? '#FFFFFF' : colors.textSoft }]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            disabled={saving}
            onPress={handleSaveRoute}
            style={[styles.saveButton, { backgroundColor: colors.deepBlue }, saving && styles.disabled]}
          >
            {saving ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name="navigate-outline" size={19} />}
            <Text style={styles.saveButtonText}>Save Route Assignment</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <RosterSkeleton rowCount={5} showFilters={false} />
        ) : (
          <View style={styles.list}>
            {drivers.length === 0 ? (
              <View style={[styles.emptyPanel, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No drivers found</Text>
                <Text style={[styles.emptyText, { color: colors.textSoft }]}>Create driver accounts before assigning transport routes.</Text>
              </View>
            ) : drivers.map((driver) => {
              const status = ROUTE_STATUSES.find((entry) => entry.id === normalizeRouteStatus(driver.routeStatus)) || ROUTE_STATUSES[0];
              return (
                <TouchableOpacity
                  key={driver.id}
                  onPress={() => selectDriver(driver)}
                  style={[styles.rowCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                    <Ionicons color={colors.emerald} name="person-circle-outline" size={25} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{driver.name || 'Unnamed driver'}</Text>
                    <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.textSoft }]}>
                      {(driver.vehicleId || 'Vehicle pending')} • {(driver.routeName || 'Route pending')}
                    </Text>
                    <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.muted }]}>
                      {driver.routeDestination || 'Destination pending'}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: colors.pageElevated, borderColor: colors.hairline }]}>
                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', marginRight: 12, width: 44 },
  content: { alignSelf: 'center', paddingBottom: 90, paddingTop: 16, width: '100%' },
  disabled: { opacity: 0.68 },
  driverChip: { borderRadius: 8, borderWidth: 1, marginRight: 8, paddingHorizontal: 12, paddingVertical: 9 },
  driverChipText: { fontSize: 12, fontWeight: '900' },
  driverStrip: { marginBottom: 14 },
  emptyPanel: { alignItems: 'center', borderRadius: 8, borderWidth: 1, padding: 22 },
  emptyText: { fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  fieldColumn: { flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' },
  fieldRow: { flexDirection: 'row', gap: 10 },
  formCard: { borderWidth: 1, marginBottom: 14, padding: 16 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 15, marginBottom: 14, minHeight: 48, outlineStyle: 'none', paddingHorizontal: 13 },
  list: { gap: 9 },
  metricCell: { borderRadius: 8, borderWidth: 1, flex: 1, minWidth: 116, padding: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metricLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  rowCard: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', minHeight: 78, padding: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  saveButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', minHeight: 52, marginTop: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginLeft: 8 },
  screen: { flex: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 14 },
  statusButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexGrow: 1, paddingHorizontal: 10, paddingVertical: 10 },
  statusButtonText: { fontSize: 12, fontWeight: '900' },
  statusDot: { borderRadius: 4, height: 7, marginRight: 6, width: 7 },
  statusPill: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginLeft: 10, paddingHorizontal: 9, paddingVertical: 6 },
  statusPillText: { fontSize: 10, fontWeight: '900' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  subtitle: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 48, justifyContent: 'center', marginLeft: 12, width: 48 },
  summaryPanel: { borderWidth: 1, marginBottom: 14, padding: 16 },
  title: { fontSize: 21, fontWeight: '900', marginTop: 3 },
});
