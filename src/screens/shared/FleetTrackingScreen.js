import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import FleetMap from '../../components/fleet/FleetMap';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { subscribeToFleetLocations } from '../../services/fleetTrackingService';

const formatUpdate = (updatedAt) => {
  if (!updatedAt) return 'Waiting for update';
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function FleetTrackingScreen() {
  const { userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      setErrorMessage('Your profile is not linked to an institute.');
      return undefined;
    }

    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      setErrorMessage('Live fleet data is not available yet. Ask your administrator to enable Realtime Database tracking.');
    }, 7000);
    const unsubscribe = subscribeToFleetLocations({
      instituteId: userData.instituteId,
      onChange: (nextLocations) => {
        clearTimeout(loadingTimeout);
        setLocations(nextLocations);
        setErrorMessage('');
        setLoading(false);
      },
      onError: (error) => {
        clearTimeout(loadingTimeout);
        console.error('Fleet tracking subscription failed:', error);
        setErrorMessage(error.message || 'The live fleet stream could not be loaded.');
        setLoading(false);
      },
    });
    return () => {
      clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [userData?.instituteId]);

  const activeCount = useMemo(
    () => locations.filter((location) => location.status === 'active').length,
    [locations]
  );

  const renderVehicle = ({ item }) => (
    <View style={[styles.vehicleCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.control }]}>
      <View style={[styles.vehicleIcon, { backgroundColor: item.status === 'active' ? colors.emeraldSoft : colors.card, borderColor: colors.hairline }]}>
        <Ionicons color={item.status === 'active' ? colors.emerald : colors.muted} name="bus" size={20} />
      </View>
      <View style={styles.vehicleCopy}>
        <Text style={[styles.vehicleTitle, { color: colors.text }]}>{item.vehicleId}</Text>
        <Text numberOfLines={1} style={[styles.vehicleMeta, { color: colors.textSoft }]}>{item.routeName || item.driverName || 'Route pending'}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: item.status === 'active' ? colors.emeraldSoft : colors.card, borderColor: colors.hairline }]}>
        <View style={[styles.statusDot, { backgroundColor: item.status === 'active' ? colors.emerald : colors.muted }]} />
        <Text style={[styles.statusText, { color: item.status === 'active' ? colors.emerald : colors.muted }]}>
          {item.status === 'active' ? formatUpdate(item.updatedAt) : 'Offline'}
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
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Realtime Database stream</Text>
            <Text style={[styles.title, { color: colors.text }]}>Campus fleet monitor</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>Live coordinates are isolated to your Institute ID.</Text>
          </View>
          <View style={[styles.countPill, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
            <Text style={[styles.countText, { color: colors.emerald }]}>{activeCount} live</Text>
          </View>
        </View>

        <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          {loading ? <View style={styles.center}><SmoothSpinner color={colors.accent} /></View> : <FleetMap accent={colors.accent} locations={locations} mutedColor={colors.muted} textColor={colors.text} />}
        </View>

        {errorMessage ? <Text style={[styles.errorText, { color: colors.warning }]}>{errorMessage}</Text> : null}

        <View style={styles.listWrap}>
          <FlashList
            data={locations}
            keyExtractor={(item) => item.vehicleId}
            renderItem={renderVehicle}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={!loading ? <Text style={[styles.emptyText, { color: colors.textSoft }]}>No vehicles have reported a location yet.</Text> : null}
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
  countText: { fontSize: 12, fontWeight: '900' },
  emptyText: { fontSize: 13, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  errorText: { fontSize: 12, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  listWrap: { flex: 1, minHeight: 120 },
  mapCard: { borderWidth: 1, height: 280, marginBottom: 12, overflow: 'hidden' },
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
