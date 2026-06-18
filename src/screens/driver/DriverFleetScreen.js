import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import FleetMap from '../../components/fleet/FleetMap';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import {
  startDriverLocationBroadcast,
  startDriverLocationPreview,
} from '../../services/fleetTrackingService';
import { showNativeError, showNativeMessage } from '../../utils/userFeedback';

const TRACKING_MODE = {
  idle: {
    icon: 'radio-outline',
    label: 'Ready for route',
    tone: 'idle',
  },
  live: {
    icon: 'radio',
    label: 'Live sharing active',
    tone: 'live',
  },
  preview: {
    icon: 'map-outline',
    label: 'Device map preview',
    tone: 'preview',
  },
};

const deriveRouteParts = (profile = {}) => {
  const routeName = String(profile.routeName || '').trim();
  const explicitDestination = String(profile.routeDestination || profile.destination || '').trim();
  const explicitOrigin = String(profile.routeOrigin || profile.origin || '').trim();
  const routeMatch = routeName.match(/^\s*(.*?)\s+\bto\b\s+(.*?)\s*$/i);
  const origin = explicitOrigin || routeMatch?.[1]?.trim() || 'Start point pending';
  const destination = explicitDestination || routeMatch?.[2]?.trim() || 'Destination pending';

  return {
    destination,
    origin,
    routeLabel: routeName || [origin, destination].filter(Boolean).join(' to ') || 'Assigned route pending',
  };
};

const formatCoordinate = (value) => (
  Number.isFinite(value) ? value.toFixed(5) : 'Pending'
);

const formatStartTime = (startedAt) => {
  if (!startedAt) return 'Not started';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(startedAt);
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export default function DriverFleetScreen() {
  const { currentUser, logout, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const sessionRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [trackingMode, setTrackingMode] = useState('idle');
  const [trackingNotice, setTrackingNotice] = useState('');

  useEffect(() => () => {
    sessionRef.current?.stop?.().catch(() => {});
  }, []);

  const startBroadcast = async () => {
    if (!currentUser || !userData?.vehicleId) {
      showNativeError(
        'Vehicle assignment needed',
        new Error('Ask your institute administrator to assign a Vehicle ID to this driver account.'),
        'Ask your institute administrator to assign a Vehicle ID to this driver account.'
      );
      return;
    }
    if (userData?.routeStatus && userData.routeStatus !== 'active') {
      showNativeError(
        'Route is not active',
        new Error('Ask your institute administrator to activate this route before starting live tracking.'),
        'Ask your institute administrator to activate this route before starting live tracking.'
      );
      return;
    }
    setStarting(true);
    setTrackingNotice('');

    try {
      sessionRef.current = await startDriverLocationBroadcast({
        currentUser,
        profile: userData,
        onLocation: setLastLocation,
      });
      setStartedAt(new Date());
      setTrackingMode(sessionRef.current?.mode || 'live');
      setTrackingNotice('Live sharing is connected for your institute.');
      showNativeMessage('Route started', 'Live location sharing is now connected.');
    } catch (liveError) {
      console.warn('Driver live broadcast unavailable; starting device preview:', liveError);

      try {
        sessionRef.current = await startDriverLocationPreview({
          currentUser,
          profile: userData,
          onLocation: setLastLocation,
        });
        setStartedAt(new Date());
        setTrackingMode('preview');
        setTrackingNotice('Device preview is active. Live sharing did not connect, so admins and parents may not see this position yet.');
        showNativeError(
          'Live sharing unavailable',
          liveError,
          'Driver map preview is open on this device, but institute sharing did not connect.'
        );
      } catch (previewError) {
        setTrackingMode('idle');
        setTrackingNotice('');
        showNativeError(
          'Route could not start',
          previewError,
          'Location could not be started on this device.'
        );
      }
    } finally {
      setStarting(false);
    }
  };

  const stopBroadcast = async () => {
    setStarting(true);
    const previousMode = trackingMode;
    try {
      await sessionRef.current?.stop?.();
      sessionRef.current = null;
      setTrackingMode('idle');
      setTrackingNotice(previousMode === 'preview'
        ? 'Device preview stopped.'
        : 'Live route sharing stopped.');
      showNativeMessage('Route ended', previousMode === 'preview' ? 'Device preview stopped.' : 'Live sharing stopped.');
    } catch (error) {
      showNativeError('Route stop failed', error, 'The route status could not be updated.');
    } finally {
      setStarting(false);
    }
  };

  const routeParts = useMemo(() => deriveRouteParts(userData), [userData]);
  const trackingActive = trackingMode !== 'idle';
  const modeConfig = TRACKING_MODE[trackingMode] || TRACKING_MODE.idle;
  const statusColor = trackingMode === 'live'
    ? colors.emerald
    : trackingMode === 'preview'
      ? colors.amber
      : colors.accent;
  const statusSoft = trackingMode === 'live'
    ? colors.emeraldSoft
    : trackingMode === 'preview'
      ? colors.amberSoft
      : colors.deepBlueSoft;

  const mapLocations = useMemo(() => {
    if (!lastLocation) {
      const originLatitude = toFiniteNumber(userData?.routeOriginLatitude ?? userData?.transportControl?.routeMap?.origin?.latitude);
      const originLongitude = toFiniteNumber(userData?.routeOriginLongitude ?? userData?.transportControl?.routeMap?.origin?.longitude);
      const destinationLatitude = toFiniteNumber(userData?.routeDestinationLatitude ?? userData?.transportControl?.routeMap?.destination?.latitude);
      const destinationLongitude = toFiniteNumber(userData?.routeDestinationLongitude ?? userData?.transportControl?.routeMap?.destination?.longitude);

      if ([originLatitude, originLongitude, destinationLatitude, destinationLongitude].some((value) => value === null)) return [];

      return [{
        accuracy: null,
        driverName: userData?.name || 'Driver',
        driverUid: currentUser?.uid || userData?.uid || 'driver',
        heading: null,
        instituteId: userData?.instituteId || 'institute',
        latitude: originLatitude,
        longitude: originLongitude,
        routeDestination: routeParts.destination,
        routeDestinationLatitude: destinationLatitude,
        routeDestinationLongitude: destinationLongitude,
        routeName: userData?.routeName || routeParts.routeLabel,
        routeOrigin: routeParts.origin,
        routeOriginLatitude: originLatitude,
        routeOriginLongitude: originLongitude,
        speed: null,
        status: 'assigned',
        updatedAt: null,
        vehicleId: userData?.vehicleId || 'Vehicle',
      }];
    }

    return [{
      ...lastLocation,
      driverName: userData?.name || lastLocation.driverName || 'Driver',
      routeDestination: lastLocation.routeDestination || routeParts.destination,
      routeDestinationLatitude: lastLocation.routeDestinationLatitude ?? userData?.routeDestinationLatitude ?? userData?.transportControl?.routeMap?.destination?.latitude ?? null,
      routeDestinationLongitude: lastLocation.routeDestinationLongitude ?? userData?.routeDestinationLongitude ?? userData?.transportControl?.routeMap?.destination?.longitude ?? null,
      routeName: userData?.routeName || lastLocation.routeName || null,
      routeOrigin: lastLocation.routeOrigin || routeParts.origin,
      routeOriginLatitude: lastLocation.routeOriginLatitude ?? userData?.routeOriginLatitude ?? userData?.transportControl?.routeMap?.origin?.latitude ?? null,
      routeOriginLongitude: lastLocation.routeOriginLongitude ?? userData?.routeOriginLongitude ?? userData?.transportControl?.routeMap?.origin?.longitude ?? null,
      status: trackingActive ? 'active' : 'offline',
      vehicleId: userData?.vehicleId || lastLocation.vehicleId || 'Vehicle',
    }];
  }, [currentUser?.uid, lastLocation, routeParts.destination, routeParts.origin, routeParts.routeLabel, trackingActive, userData]);

  const openExternalMap = async () => {
    if (!lastLocation) return;
    await Linking.openURL(
      `https://www.openstreetmap.org/?locale=en&mlat=${lastLocation.latitude}&mlon=${lastLocation.longitude}#map=16/${lastLocation.latitude}/${lastLocation.longitude}`
    );
  };

  const latestPosition = lastLocation
    ? `${formatCoordinate(lastLocation.latitude)}, ${formatCoordinate(lastLocation.longitude)}`
    : 'Waiting for GPS';
  const accuracyText = lastLocation?.accuracy
    ? `Accuracy ${Math.round(lastLocation.accuracy)} m`
    : 'Accuracy pending';
  const speedText = Number.isFinite(lastLocation?.speed)
    ? `${Math.max(0, Math.round(lastLocation.speed * 3.6))} km/h`
    : trackingActive ? 'Moving' : 'Pending';

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
        style={styles.scrollView}
      >
        <View style={[styles.hero, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: statusSoft, borderColor: colors.hairline }]}>
              <Ionicons color={statusColor} name="bus" size={30} />
            </View>
            <View style={styles.heroCopy}>
              <View style={[styles.statusPill, { backgroundColor: statusSoft, borderColor: colors.hairline }]}>
                <Ionicons color={statusColor} name={modeConfig.icon} size={14} />
                <Text style={[styles.statusPillText, { color: statusColor }]}>{modeConfig.label}</Text>
              </View>
              <Text style={[styles.vehicleId, { color: colors.text }]}>{userData?.vehicleId || 'Vehicle ID pending'}</Text>
              <Text style={[styles.routeName, { color: colors.textSoft }]}>{routeParts.routeLabel}</Text>
            </View>
          </View>

          <View style={styles.routeGrid}>
            <View style={[styles.routeTile, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
              <Text style={[styles.routeTileLabel, { color: colors.muted }]}>From</Text>
              <Text numberOfLines={2} style={[styles.routeTileValue, { color: colors.text }]}>{routeParts.origin}</Text>
            </View>
            <View style={[styles.routeTile, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
              <Text style={[styles.routeTileLabel, { color: colors.muted }]}>To</Text>
              <Text numberOfLines={2} style={[styles.routeTileValue, { color: colors.text }]}>{routeParts.destination}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.mapToolbar, { borderBottomColor: colors.hairline }]}>
            <View>
              <Text style={[styles.mapTitle, { color: colors.text }]}>Driver map</Text>
              <Text style={[styles.mapSubtitle, { color: colors.textSoft }]}>
                {trackingActive ? 'Current device position' : 'Assigned route preview'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Open current position in map"
              accessibilityRole="button"
              activeOpacity={0.82}
              disabled={!lastLocation}
              onPress={openExternalMap}
              style={[
                styles.mapAction,
                { backgroundColor: colors.cardStrong, borderColor: colors.hairline },
                !lastLocation && styles.disabled,
              ]}
            >
              <Ionicons color={lastLocation ? colors.text : colors.muted} name="open-outline" size={17} />
              <Text style={[styles.mapActionText, { color: lastLocation ? colors.text : colors.muted }]}>Open</Text>
            </TouchableOpacity>
          </View>
          <FleetMap
            accent={statusColor}
            locations={mapLocations}
            mutedColor={colors.muted}
            textColor={colors.text}
          />
        </View>

        {trackingNotice ? (
          <View style={[styles.noticeCard, { backgroundColor: statusSoft, borderColor: colors.hairline, borderRadius: radii.control }]}>
            <Ionicons color={statusColor} name={trackingMode === 'preview' ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18} />
            <Text style={[styles.noticeText, { color: colors.text }]}>{trackingNotice}</Text>
          </View>
        ) : null}

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
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSoft }]}>Started</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{formatStartTime(startedAt)}</Text>
          </View>
          <View style={[styles.statusRow, styles.statusRowLast]}>
            <Text style={[styles.statusLabel, { color: colors.textSoft }]}>Motion</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{speedText}</Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityLabel={trackingActive ? 'End live route' : 'Start live route'}
          accessibilityRole="button"
          activeOpacity={0.86}
          disabled={starting}
          onPress={trackingActive ? stopBroadcast : startBroadcast}
          style={[
            styles.primaryButton,
            { backgroundColor: trackingActive ? '#B91C1C' : colors.deepBlue, borderColor: colors.hairline },
            starting && styles.disabled,
          ]}
        >
          {starting ? <SmoothSpinner color="#FFFFFF" /> : <Ionicons color="#FFFFFF" name={trackingActive ? 'stop-circle' : 'navigate-circle'} size={22} />}
          <Text style={styles.primaryButtonText}>{trackingActive ? 'End Route' : 'Start Route'}</Text>
        </TouchableOpacity>

        <Text style={[styles.safetyText, { color: colors.textSoft }]}>
          Keep this screen open during the route. If live sharing is unavailable, the map will still show this device position for the driver.
        </Text>

        <TouchableOpacity
          accessibilityLabel="Secure sign out"
          accessibilityRole="button"
          activeOpacity={0.82}
          onPress={logout}
          style={[styles.signOutButton, { backgroundColor: colors.card, borderColor: colors.hairline }]}
        >
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
  hero: { borderWidth: 1, padding: 18 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroIcon: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 58, justifyContent: 'center', marginRight: 14, width: 58 },
  heroTop: { alignItems: 'center', flexDirection: 'row' },
  mapAction: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 38, paddingHorizontal: 12 },
  mapActionText: { fontSize: 12, fontWeight: '900', marginLeft: 6 },
  mapCard: { borderWidth: 1, height: 390, marginTop: 14, overflow: 'hidden' },
  mapSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  mapTitle: { fontSize: 15, fontWeight: '900' },
  mapToolbar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  noticeCard: { alignItems: 'flex-start', borderWidth: 1, flexDirection: 'row', marginTop: 14, padding: 12 },
  noticeText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 18, marginLeft: 8 },
  primaryButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 56, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginLeft: 8 },
  routeDestination: { fontSize: 12, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  routeGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  routeName: { fontSize: 13, fontWeight: '700', marginTop: 5 },
  routeTile: { borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 68, padding: 10 },
  routeTileLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  routeTileValue: { fontSize: 13, fontWeight: '900', lineHeight: 18, marginTop: 5 },
  safetyText: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginHorizontal: 16, marginTop: 12, textAlign: 'center' },
  screen: { flex: 1, overflow: 'hidden' },
  scrollView: { flex: 1, minHeight: 0 },
  signOutButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', marginTop: 22, minHeight: 50 },
  signOutText: { color: '#EF4444', fontSize: 14, fontWeight: '900', marginLeft: 7 },
  statusCard: { borderWidth: 1, marginBottom: 14, marginTop: 14, padding: 16 },
  statusLabel: { fontSize: 12, fontWeight: '800' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statusRowLast: { marginBottom: 0 },
  statusPill: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 30, paddingHorizontal: 9 },
  statusPillText: { fontSize: 10, fontWeight: '900', marginLeft: 5, textTransform: 'uppercase' },
  statusValue: { fontSize: 12, fontWeight: '900', marginLeft: 14, maxWidth: '64%', textAlign: 'right' },
  vehicleId: { fontSize: 25, fontWeight: '900', marginTop: 5 },
});
