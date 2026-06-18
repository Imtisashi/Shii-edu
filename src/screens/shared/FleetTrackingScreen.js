import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import FleetMap from '../../components/fleet/FleetMap';
import { SkeletonBlock } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import {
  isFleetLiveLocationBackendEnabled,
  subscribeToFleetLocations,
  subscribeToFleetRouteAssignments,
} from '../../services/fleetTrackingService';

const formatUpdate = (updatedAt) => {
  if (!updatedAt) return 'Waiting for update';
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function FleetTrackingScreen() {
  const { userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [liveLocations, setLiveLocations] = useState([]);
  const [assignedRoutes, setAssignedRoutes] = useState([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [liveErrorMessage, setLiveErrorMessage] = useState('');
  const [routeErrorMessage, setRouteErrorMessage] = useState('');

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoadingLive(false);
      setLoadingRoutes(false);
      setLiveErrorMessage('Your profile is not linked to an institute.');
      return undefined;
    }

    if (!isFleetLiveLocationBackendEnabled()) {
      setLiveLocations([]);
      setLoadingLive(false);
      setLiveErrorMessage('Live positions are not connected yet. Assigned route maps are still available below.');
      return undefined;
    }

    const loadingTimeout = setTimeout(() => {
      setLoadingLive(false);
      setLiveErrorMessage('Live positions are not connected yet. Assigned route maps are still available below.');
    }, 7000);
    const unsubscribe = subscribeToFleetLocations({
      instituteId: userData.instituteId,
      onChange: (nextLocations) => {
        clearTimeout(loadingTimeout);
        setLiveLocations(nextLocations);
        setLiveErrorMessage('');
        setLoadingLive(false);
      },
      onError: (error) => {
        clearTimeout(loadingTimeout);
        console.error('Fleet tracking subscription failed:', error);
        setLiveErrorMessage(error.message || 'Live positions could not be loaded.');
        setLoadingLive(false);
      },
    });
    return () => {
      clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [userData?.instituteId]);

  useEffect(() => {
    if (!userData?.instituteId) {
      setAssignedRoutes([]);
      setLoadingRoutes(false);
      return undefined;
    }

    setLoadingRoutes(true);
    const unsubscribe = subscribeToFleetRouteAssignments({
      instituteId: userData.instituteId,
      onChange: (nextRoutes) => {
        setAssignedRoutes(nextRoutes);
        setRouteErrorMessage('');
        setLoadingRoutes(false);
      },
      onError: (error) => {
        console.error('Fleet route assignment subscription failed:', error);
        setRouteErrorMessage(error.message || 'Assigned routes could not be loaded.');
        setLoadingRoutes(false);
      },
    });
    return unsubscribe;
  }, [userData?.instituteId]);

  const locations = useMemo(() => {
    const byVehicle = new Map();
    assignedRoutes.forEach((route) => {
      byVehicle.set(route.vehicleId, route);
    });
    liveLocations.forEach((location) => {
      const assignedRoute = byVehicle.get(location.vehicleId) || {};
      byVehicle.set(location.vehicleId, {
        ...assignedRoute,
        ...location,
        routeDestination: location.routeDestination || assignedRoute.routeDestination || null,
        routeDestinationLatitude: location.routeDestinationLatitude ?? assignedRoute.routeDestinationLatitude ?? null,
        routeDestinationLongitude: location.routeDestinationLongitude ?? assignedRoute.routeDestinationLongitude ?? null,
        routeName: location.routeName || assignedRoute.routeName || null,
        routeOrigin: location.routeOrigin || assignedRoute.routeOrigin || null,
        routeOriginLatitude: location.routeOriginLatitude ?? assignedRoute.routeOriginLatitude ?? null,
        routeOriginLongitude: location.routeOriginLongitude ?? assignedRoute.routeOriginLongitude ?? null,
      });
    });
    return Array.from(byVehicle.values())
      .sort((left, right) => String(left.vehicleId).localeCompare(String(right.vehicleId)));
  }, [assignedRoutes, liveLocations]);

  const loading = loadingLive && loadingRoutes;
  const errorMessage = locations.length === 0
    ? routeErrorMessage || liveErrorMessage
    : liveErrorMessage;
  const activeCount = useMemo(
    () => locations.filter((location) => location.status === 'active').length,
    [locations]
  );
  const assignedCount = useMemo(
    () => locations.filter((location) => location.status === 'assigned').length,
    [locations]
  );

  const renderVehicle = ({ item }) => (
    <View style={[styles.vehicleCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.control }]}>
      <View style={[styles.vehicleIcon, { backgroundColor: item.status === 'active' ? colors.emeraldSoft : colors.card, borderColor: colors.hairline }]}>
        <Ionicons color={item.status === 'active' ? colors.emerald : item.status === 'assigned' ? colors.accent : colors.muted} name={item.status === 'active' ? 'bus' : 'map-outline'} size={20} />
      </View>
      <View style={styles.vehicleCopy}>
        <Text style={[styles.vehicleTitle, { color: colors.text }]}>{item.vehicleId}</Text>
        <Text numberOfLines={1} style={[styles.vehicleMeta, { color: colors.textSoft }]}>{item.routeOrigin && item.routeDestination ? `${item.routeOrigin} to ${item.routeDestination}` : item.routeName || item.driverName || 'Route pending'}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: item.status === 'active' ? colors.emeraldSoft : colors.card, borderColor: colors.hairline }]}>
        <View style={[styles.statusDot, { backgroundColor: item.status === 'active' ? colors.emerald : item.status === 'assigned' ? colors.accent : colors.muted }]} />
        <Text style={[styles.statusText, { color: item.status === 'active' ? colors.emerald : item.status === 'assigned' ? colors.accent : colors.muted }]}>
          {item.status === 'active' ? formatUpdate(item.updatedAt) : item.status === 'assigned' ? 'Assigned' : 'Offline'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader showBack title="Live Fleet" />

      <View style={[styles.content, { maxWidth: maxContentWidth, paddingHorizontal: spacing.pageX }]}>
        <View style={[styles.summary, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Map-based transport</Text>
            <Text style={[styles.title, { color: colors.text }]}>Campus route monitor</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>Assigned routes stay visible even before a driver begins live sharing.</Text>
          </View>
          <View style={styles.countStack}>
            <View style={[styles.countPill, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
              <Text style={[styles.countText, { color: colors.emerald }]}>{activeCount} live</Text>
            </View>
            <View style={[styles.countPill, { backgroundColor: colors.deepBlueSoft, borderColor: colors.hairline }]}>
              <Text style={[styles.countText, { color: colors.accent }]}>{assignedCount} assigned</Text>
            </View>
          </View>
        </View>

        <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          {loading ? (
            <View style={styles.mapSkeleton}>
              <SkeletonBlock height={188} radius={8} width="100%" />
              <View style={styles.mapSkeletonFooter}>
                <SkeletonBlock height={34} radius={8} width="46%" />
                <SkeletonBlock height={34} radius={8} width="32%" />
              </View>
            </View>
          ) : <FleetMap accent={colors.accent} locations={locations} mutedColor={colors.muted} textColor={colors.text} />}
        </View>

        {errorMessage ? <Text style={[styles.errorText, { color: colors.warning }]}>{errorMessage}</Text> : null}

        <View style={styles.listWrap}>
          <FlashList
            data={locations}
            keyExtractor={(item) => item.vehicleId}
            renderItem={renderVehicle}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={!loading ? <Text style={[styles.emptyText, { color: colors.textSoft }]}>No active buses or assigned route maps are available yet.</Text> : null}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { alignSelf: 'center', flex: 1, paddingBottom: 18, paddingTop: 14, width: '100%' },
  countPill: { borderRadius: 8, borderWidth: 1, marginLeft: 12, paddingHorizontal: 12, paddingVertical: 8 },
  countStack: { alignItems: 'flex-end', gap: 7 },
  countText: { fontSize: 12, fontWeight: '900' },
  emptyText: { fontSize: 13, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  errorText: { fontSize: 12, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  listWrap: { flex: 1, minHeight: 120 },
  mapCard: { borderWidth: 1, height: 280, marginBottom: 12, overflow: 'hidden' },
  mapSkeleton: { flex: 1, justifyContent: 'space-between', padding: 12 },
  mapSkeletonFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  screen: { flex: 1, overflow: 'hidden' },
  statusDot: { borderRadius: 4, height: 7, marginRight: 5, width: 7 },
  statusPill: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginLeft: 10, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 5 },
  summary: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: '900', marginTop: 3 },
  vehicleCard: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', marginBottom: 8, minHeight: 66, padding: 10 },
  vehicleCopy: { flex: 1, minWidth: 0 },
  vehicleIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', marginRight: 10, width: 42 },
  vehicleMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  vehicleTitle: { fontSize: 14, fontWeight: '900' },
});
