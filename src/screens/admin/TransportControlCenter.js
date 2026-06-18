import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import FleetMap from '../../components/fleet/FleetMap';
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
const parseCoordinate = (value) => {
  const number = Number(String(value || '').trim());
  return Number.isFinite(number) ? number : null;
};
const formatCoordinateInput = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
};
const splitRouteName = (routeName) => {
  const match = String(routeName || '').match(/^\s*(.*?)\s+\bto\b\s+(.*?)\s*$/i);
  return {
    destination: match?.[2]?.trim() || '',
    origin: match?.[1]?.trim() || '',
  };
};
const routeMapFromDriver = (driver) => driver?.transportControl?.routeMap || {};
const safeAssignmentIdPart = (value) => String(value || 'route')
  .trim()
  .replace(/[^\w.-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'route';
const routeAssignmentDocId = (instituteId, assignedVehicleId) => (
  `${safeAssignmentIdPart(instituteId)}_${safeAssignmentIdPart(assignedVehicleId)}`
);

export default function TransportControlCenter() {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeOrigin, setRouteOrigin] = useState('');
  const [routeOriginLatitude, setRouteOriginLatitude] = useState('');
  const [routeOriginLongitude, setRouteOriginLongitude] = useState('');
  const [routeDestination, setRouteDestination] = useState('');
  const [routeDestinationLatitude, setRouteDestinationLatitude] = useState('');
  const [routeDestinationLongitude, setRouteDestinationLongitude] = useState('');
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

  const selectDriver = useCallback((driver) => {
    const routeMap = routeMapFromDriver(driver);
    const routeParts = splitRouteName(driver?.routeName);
    setSelectedDriver(driver);
    setVehicleId(String(driver?.vehicleId || ''));
    setRouteName(String(driver?.routeName || ''));
    setRouteOrigin(String(driver?.routeOrigin || routeMap.origin?.label || routeParts.origin || ''));
    setRouteOriginLatitude(formatCoordinateInput(driver?.routeOriginLatitude ?? routeMap.origin?.latitude));
    setRouteOriginLongitude(formatCoordinateInput(driver?.routeOriginLongitude ?? routeMap.origin?.longitude));
    setRouteDestination(String(driver?.routeDestination || routeMap.destination?.label || routeParts.destination || ''));
    setRouteDestinationLatitude(formatCoordinateInput(driver?.routeDestinationLatitude ?? routeMap.destination?.latitude));
    setRouteDestinationLongitude(formatCoordinateInput(driver?.routeDestinationLongitude ?? routeMap.destination?.longitude));
    setRouteShift(String(driver?.routeShift || ''));
    setRouteStatus(normalizeRouteStatus(driver?.routeStatus));
  }, []);

  useEffect(() => {
    if (loading) return;

    if (drivers.length === 0) {
      if (selectedDriver) selectDriver(null);
      return;
    }

    if (!selectedDriver?.id) {
      selectDriver(drivers[0]);
      return;
    }

    if (!drivers.some((driver) => driver.id === selectedDriver.id)) {
      selectDriver(drivers[0]);
    }
  }, [drivers, loading, selectDriver, selectedDriver]);

  const routePreviewLocations = useMemo(() => {
    const originLatitude = parseCoordinate(routeOriginLatitude);
    const originLongitude = parseCoordinate(routeOriginLongitude);
    const destinationLatitude = parseCoordinate(routeDestinationLatitude);
    const destinationLongitude = parseCoordinate(routeDestinationLongitude);

    if ([originLatitude, originLongitude, destinationLatitude, destinationLongitude].some((value) => value === null)) {
      return [];
    }

    const previewName = routeName.trim() || `${routeOrigin.trim() || 'Start'} to ${routeDestination.trim() || 'Destination'}`;
    return [{
      accuracy: null,
      driverName: selectedDriver?.name || 'Driver',
      driverUid: selectedDriver?.id || 'preview',
      heading: null,
      instituteId: userData?.instituteId || 'preview',
      latitude: originLatitude,
      longitude: originLongitude,
      routeDestination: routeDestination.trim() || 'Destination',
      routeDestinationLatitude: destinationLatitude,
      routeDestinationLongitude: destinationLongitude,
      routeName: previewName,
      routeOrigin: routeOrigin.trim() || 'Start',
      routeOriginLatitude: originLatitude,
      routeOriginLongitude: originLongitude,
      speed: null,
      status: 'assigned',
      updatedAt: null,
      vehicleId: vehicleId.trim() || 'Route preview',
    }];
  }, [
    routeDestination,
    routeDestinationLatitude,
    routeDestinationLongitude,
    routeName,
    routeOrigin,
    routeOriginLatitude,
    routeOriginLongitude,
    selectedDriver?.id,
    selectedDriver?.name,
    userData?.instituteId,
    vehicleId,
  ]);

  const handleSaveRoute = async () => {
    Keyboard.dismiss();
    if (!selectedDriver) {
      showNativeMessage('Select Driver', 'Choose a driver before assigning route controls.');
      return;
    }

    const trimmedVehicleId = vehicleId.trim();
    const trimmedOrigin = routeOrigin.trim();
    const trimmedDestination = routeDestination.trim();
    const originLatitude = parseCoordinate(routeOriginLatitude);
    const originLongitude = parseCoordinate(routeOriginLongitude);
    const destinationLatitude = parseCoordinate(routeDestinationLatitude);
    const destinationLongitude = parseCoordinate(routeDestinationLongitude);
    const trimmedRouteName = routeName.trim() || `${trimmedOrigin} to ${trimmedDestination}`;

    if (!trimmedVehicleId || !trimmedOrigin || !trimmedDestination) {
      showNativeMessage('Incomplete Route', 'Vehicle ID, start point, and destination are required.');
      return;
    }

    if ([originLatitude, originLongitude, destinationLatitude, destinationLongitude].some((value) => value === null)) {
      showNativeMessage('Map Points Required', 'Add valid latitude and longitude for both start and destination.');
      return;
    }

    setSaving(true);
    try {
      const assignedBy = currentUser?.uid || userData?.uid || null;
      const assignedAt = serverTimestamp();
      const routeMap = {
        destination: {
          label: trimmedDestination,
          latitude: destinationLatitude,
          longitude: destinationLongitude,
        },
        origin: {
          label: trimmedOrigin,
          latitude: originLatitude,
          longitude: originLongitude,
        },
      };
      const routeControl = {
        assignedAt,
        assignedBy,
        destination: trimmedDestination,
        routeMap,
        routeName: trimmedRouteName,
        origin: trimmedOrigin,
        shift: routeShift.trim(),
        status: routeStatus,
        vehicleId: trimmedVehicleId,
      };
      const driverRoutePayload = {
        routeAssignedAt: serverTimestamp(),
        routeAssignedBy: assignedBy,
        routeDestination: trimmedDestination,
        routeDestinationLatitude: destinationLatitude,
        routeDestinationLongitude: destinationLongitude,
        routeName: trimmedRouteName,
        routeOrigin: trimmedOrigin,
        routeOriginLatitude: originLatitude,
        routeOriginLongitude: originLongitude,
        routeShift: routeShift.trim(),
        routeStatus,
        transportControl: routeControl,
        vehicleId: trimmedVehicleId,
      };
      const routeAssignmentPayload = {
        ...driverRoutePayload,
        assignedAt,
        assignedBy,
        driverLoginId: getDriverId(selectedDriver),
        driverName: selectedDriver.name || 'Driver',
        driverUid: selectedDriver.id,
        instituteId: userData.instituteId,
        name: selectedDriver.name || 'Driver',
        role: 'driver',
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', selectedDriver.id), driverRoutePayload);
      batch.set(
        doc(db, 'fleetRouteAssignments', routeAssignmentDocId(userData.instituteId, trimmedVehicleId)),
        routeAssignmentPayload,
        { merge: true }
      );
      await batch.commit();
      showNativeMessage('Route Updated', `${selectedDriver.name || 'Driver'} is assigned to ${trimmedRouteName}.`);
      setSelectedDriver(null);
      setVehicleId('');
      setRouteName('');
      setRouteOrigin('');
      setRouteOriginLatitude('');
      setRouteOriginLongitude('');
      setRouteDestination('');
      setRouteDestinationLatitude('');
      setRouteDestinationLongitude('');
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
        style={styles.scrollView}
      >
        <View style={[styles.summaryPanel, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.muted }]}>Transport operations</Text>
              <Text style={[styles.title, { color: colors.text }]}>Map routes, destinations, and drivers</Text>
              <Text style={[styles.subtitle, { color: colors.textSoft }]}>Assign origin and destination map points once; driver and parent views read the same route.</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Assign driver to map route</Text>
          <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Driver</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.driverStrip}>
            {drivers.map((driver) => {
              const selected = selectedDriver?.id === driver.id;
              return (
                <TouchableOpacity
                  key={driver.id}
                  accessibilityLabel={`Select driver ${driver.name || getDriverId(driver)}`}
                  accessibilityRole="button"
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
                placeholder="Auto: Start to Destination"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeName}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Start point</Text>
              <TextInput
                onChangeText={setRouteOrigin}
                placeholder="e.g. Kohima campus gate"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeOrigin}
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Destination</Text>
              <TextInput
                onChangeText={setRouteDestination}
                placeholder="e.g. Dimapur pickup point"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeDestination}
              />
            </View>
          </View>

          <View style={styles.coordinateGrid}>
            <View style={styles.coordinateColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Start latitude</Text>
              <TextInput
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setRouteOriginLatitude}
                placeholder="25.6751"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.coordinateInput, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeOriginLatitude}
              />
            </View>
            <View style={styles.coordinateColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Start longitude</Text>
              <TextInput
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setRouteOriginLongitude}
                placeholder="94.1086"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.coordinateInput, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeOriginLongitude}
              />
            </View>
          </View>

          <View style={styles.coordinateGrid}>
            <View style={styles.coordinateColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Destination latitude</Text>
              <TextInput
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setRouteDestinationLatitude}
                placeholder="25.9063"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.coordinateInput, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeDestinationLatitude}
              />
            </View>
            <View style={styles.coordinateColumn}>
              <Text style={[styles.fieldLabel, { color: colors.textSoft }]}>Destination longitude</Text>
              <TextInput
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setRouteDestinationLongitude}
                placeholder="93.7276"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.coordinateInput, { backgroundColor: colors.pageElevated, borderColor: colors.hairline, color: colors.text }]}
                value={routeDestinationLongitude}
              />
            </View>
          </View>

          <View style={[styles.mapPreviewCard, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
            <FleetMap
              accent={colors.emerald}
              locations={routePreviewLocations}
              mutedColor={colors.textSoft}
              textColor={colors.text}
            />
          </View>

          <View style={styles.fieldRow}>
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
                  accessibilityLabel={`Set route status to ${status.label}`}
                  accessibilityRole="button"
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
            accessibilityLabel="Save map route assignment"
            accessibilityRole="button"
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
                  accessibilityLabel={`Edit route for ${driver.name || getDriverId(driver)}`}
                  accessibilityRole="button"
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
                      {driver.routeOrigin && driver.routeDestination
                        ? `${driver.routeOrigin} to ${driver.routeDestination}`
                        : driver.routeDestination || 'Map points pending'}
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
  coordinateColumn: { flex: 1, minWidth: 118 },
  coordinateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  coordinateInput: { fontVariant: ['tabular-nums'] },
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
  mapPreviewCard: { borderRadius: 8, borderWidth: 1, height: 260, marginBottom: 14, overflow: 'hidden' },
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
  scrollView: { flex: 1, minHeight: 0 },
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
