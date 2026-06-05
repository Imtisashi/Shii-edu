import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildOpenStreetMapEmbedUrl = (location) => {
  const latitude = toFiniteNumber(location?.latitude);
  const longitude = toFiniteNumber(location?.longitude);
  if (latitude === null || longitude === null) return null;

  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].map((value) => value.toFixed(6)).join('%2C');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;
};

export default function FleetMap({ locations, accent = '#2563EB', mutedColor = '#8EA4C8', textColor = '#F8FAFC' }) {
  const activeLocations = locations.filter((location) => location.status === 'active');
  const primaryLocation = activeLocations[0] || null;
  const embedUrl = buildOpenStreetMapEmbedUrl(primaryLocation);

  return (
    <View style={styles.container}>
      {embedUrl ? (
        <View style={styles.mapFrame}>
          <iframe
            aria-label={`Live map for ${primaryLocation.vehicleId || primaryLocation.driverName || 'active vehicle'}`}
            src={embedUrl}
            style={styles.iframe}
            title={`Live map for ${primaryLocation.vehicleId || 'vehicle'}`}
          />
        </View>
      ) : (
        <View style={styles.emptyMap}>
          <Ionicons color={accent} name="map-outline" size={34} />
          <Text style={[styles.title, { color: textColor }]}>Live map waiting</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>Start a route to show the current vehicle position.</Text>
        </View>
      )}

      {activeLocations.length > 0 ? (
        <View style={styles.vehicleStrip}>
          <Text numberOfLines={1} style={[styles.title, styles.stripTitle, { color: textColor }]}>
            {primaryLocation.vehicleId || 'Vehicle'} live now
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, styles.stripSubtitle, { color: mutedColor }]}>
            {primaryLocation.routeName || primaryLocation.driverName || 'Route active'}
          </Text>
        </View>
      ) : null}

      {activeLocations.map((location) => (
        <TouchableOpacity
          key={location.vehicleId}
          onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`)}
          style={styles.link}
        >
          <Ionicons color={accent} name="bus-outline" size={18} />
          <Text style={[styles.linkText, { color: accent }]}>{location.vehicleId}</Text>
        </TouchableOpacity>
      ))}
      {activeLocations.length === 0 ? <Text style={[styles.empty, { color: mutedColor }]}>No active vehicles are broadcasting right now.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  emptyMap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    width: '100%',
  },
  empty: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  link: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 12,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 7,
  },
  iframe: {
    borderWidth: 0,
    height: '100%',
    width: '100%',
  },
  mapFrame: {
    borderRadius: 8,
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  stripSubtitle: {
    marginTop: 2,
  },
  stripTitle: {
    marginTop: 0,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  vehicleStrip: {
    alignItems: 'center',
    paddingTop: 10,
    width: '100%',
  },
});
