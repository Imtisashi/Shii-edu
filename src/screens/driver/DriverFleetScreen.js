import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import FleetMap from '../../components/fleet/FleetMap';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { startDriverLocationBroadcast } from '../../services/fleetTrackingService';

const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

export default function DriverFleetScreen() {
  const { currentUser, logout, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const sessionRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);

  useEffect(() => () => {
    sessionRef.current?.stop?.().catch(() => {});
  }, []);

  const startBroadcast = async () => {
    if (!currentUser || !userData?.vehicleId) {
      showMessage('Vehicle Assignment Required', 'Ask your institute administrator to assign a Vehicle ID to this driver account.');
      return;
    }
    if (userData?.routeStatus && userData.routeStatus !== 'active') {
      showMessage('Route Not Active', 'Ask your institute administrator to activate this route before starting live tracking.');
      return;
    }
    setStarting(true);
    try {
      sessionRef.current = await startDriverLocationBroadcast({
        currentUser,
        profile: userData,
        onLocation: setLastLocation,
      });
      setBroadcasting(true);
    } catch (error) {
      showMessage('Broadcast Not Started', error.message || 'Location broadcasting could not be started.');
    } finally {
      setStarting(false);
    }
  };

  const stopBroadcast = async () => {
    setStarting(true);
    try {
      await sessionRef.current?.stop?.();
      sessionRef.current = null;
      setBroadcasting(false);
    } catch (error) {
      showMessage('Broadcast Not Stopped', error.message || 'The fleet status could not be updated.');
    } finally {
      setStarting(false);
    }
  };

  const mapLocations = useMemo(() => {
    if (!lastLocation) return [];
    return [{
      ...lastLocation,
      driverName: userData?.name || lastLocation.driverName || 'Driver',
      routeName: userData?.routeName || lastLocation.routeName || null,
      status: broadcasting ? 'active' : 'offline',
      vehicleId: userData?.vehicleId || lastLocation.vehicleId || 'Vehicle',
    }];
  }, [broadcasting, lastLocation, userData?.name, userData?.routeName, userData?.vehicleId]);

  const latestPosition = lastLocation
    ? `${lastLocation.latitude.toFixed(5)}, ${lastLocation.longitude.toFixed(5)}`
    : 'Waiting for GPS';
  const accuracyText = lastLocation?.accuracy
    ? `Accuracy ${Math.round(lastLocation.accuracy)} m`
    : 'Accuracy pending';

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Driver Console" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingHorizontal: spacing.pageX,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.heroIcon, { backgroundColor: broadcasting ? colors.emeraldSoft : colors.deepBlueSoft, borderColor: colors.hairline }]}>
            <Ionicons color={broadcasting ? colors.emerald : colors.accent} name="bus" size={34} />
          </View>
          <Text style={[styles.eyebrow, { color: broadcasting ? colors.emerald : colors.accent }]}>
            {broadcasting ? 'Live route active' : 'Ready for route'}
          </Text>
          <Text style={[styles.vehicleId, { color: colors.text }]}>{userData?.vehicleId || 'Vehicle ID pending'}</Text>
          <Text style={[styles.routeName, { color: colors.textSoft }]}>{userData?.routeName || 'Route name pending'}</Text>
          <Text style={[styles.routeDestination, { color: colors.muted }]}>
            {userData?.routeDestination || 'Destination pending'}
          </Text>
        </View>

        <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <FleetMap
            accent={broadcasting ? colors.emerald : colors.accent}
            locations={mapLocations}
            mutedColor={colors.muted}
            textColor={colors.text}
          />
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSoft }]}>Driver</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{userData?.name || 'Driver'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSoft }]}>Institute ID</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{userData?.instituteId || 'Unavailable'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSoft }]}>Latest position</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{latestPosition}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSoft }]}>Signal</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{accuracyText}</Text>
          </View>
        </View>

        <TouchableOpacity
          disabled={starting}
          onPress={broadcasting ? stopBroadcast : startBroadcast}
          style={[
            styles.primaryButton,
            { backgroundColor: broadcasting ? '#B91C1C' : colors.deepBlue, borderColor: colors.hairline },
            starting && styles.disabled,
          ]}
        >
          {starting ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name={broadcasting ? 'stop-circle' : 'navigate-circle'} size={22} />}
          <Text style={styles.primaryButtonText}>{broadcasting ? 'End Live Route' : 'Start Live Route'}</Text>
        </TouchableOpacity>

        <Text style={[styles.safetyText, { color: colors.textSoft }]}>
          Keep this screen open during the route. Location is shared only with authenticated users from your institute.
        </Text>

        <TouchableOpacity onPress={logout} style={[styles.signOutButton, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
          <Ionicons color="#EF4444" name="log-out-outline" size={18} />
          <Text style={styles.signOutText}>Secure Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', paddingBottom: 34, paddingTop: 18, width: '100%' },
  disabled: { opacity: 0.6 },
  eyebrow: { fontSize: 11, fontWeight: '900', marginTop: 16, textTransform: 'uppercase' },
  hero: { alignItems: 'center', borderWidth: 1, padding: 24 },
  heroIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 74, justifyContent: 'center', width: 74 },
  mapCard: { borderWidth: 1, height: 320, marginTop: 14, overflow: 'hidden' },
  primaryButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 56, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginLeft: 8 },
  routeDestination: { fontSize: 12, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  routeName: { fontSize: 13, fontWeight: '700', marginTop: 5 },
  safetyText: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginHorizontal: 16, marginTop: 12, textAlign: 'center' },
  screen: { flex: 1, overflow: 'hidden' },
  signOutButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', marginTop: 22, minHeight: 50 },
  signOutText: { color: '#EF4444', fontSize: 14, fontWeight: '900', marginLeft: 7 },
  statusCard: { borderWidth: 1, marginBottom: 14, marginTop: 14, padding: 16 },
  statusLabel: { fontSize: 12, fontWeight: '800' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statusValue: { fontSize: 12, fontWeight: '900', marginLeft: 14, maxWidth: '64%', textAlign: 'right' },
  vehicleId: { fontSize: 25, fontWeight: '900', marginTop: 5 },
});
