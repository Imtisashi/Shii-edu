import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAGALAND_CENTER = {
  latitude: 25.6751,
  longitude: 94.1086,
};

const NAGALAND_ROUTE_POINTS = {
  destination: {
    latitude: 25.9063,
    longitude: 93.7276,
  },
  origin: NAGALAND_CENTER,
};

const NAGALAND_BOUNDS = {
  maxLatitude: 26.95,
  maxLongitude: 95.25,
  minLatitude: 25.15,
  minLongitude: 93.3,
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isNagalandCoordinate = (latitude, longitude) => (
  latitude !== null &&
  longitude !== null &&
  latitude >= NAGALAND_BOUNDS.minLatitude &&
  latitude <= NAGALAND_BOUNDS.maxLatitude &&
  longitude >= NAGALAND_BOUNDS.minLongitude &&
  longitude <= NAGALAND_BOUNDS.maxLongitude
);

const localizeToNagaland = (latitude, longitude, fallback = NAGALAND_CENTER) => (
  isNagalandCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : fallback
);

const coordinatePairs = (location) => ([
  [location?.routeOriginLatitude, location?.routeOriginLongitude, NAGALAND_ROUTE_POINTS.origin],
  [location?.latitude, location?.longitude, NAGALAND_CENTER],
  [location?.routeDestinationLatitude, location?.routeDestinationLongitude, NAGALAND_ROUTE_POINTS.destination],
])
  .map(([latitude, longitude, fallback]) => ({
    fallback,
    latitude: toFiniteNumber(latitude),
    longitude: toFiniteNumber(longitude),
  }))
  .filter(({ latitude, longitude }) => latitude !== null && longitude !== null)
  .map(({ latitude, longitude, fallback }) => {
    const localized = localizeToNagaland(latitude, longitude, fallback);
    return [localized.latitude, localized.longitude];
  })
  .filter(([latitude, longitude]) => latitude !== null && longitude !== null);

const primaryMarker = (location) => {
  const latitude = toFiniteNumber(location?.status === 'active' ? location?.latitude : location?.routeDestinationLatitude ?? location?.latitude);
  const longitude = toFiniteNumber(location?.status === 'active' ? location?.longitude : location?.routeDestinationLongitude ?? location?.longitude);
  if (latitude === null || longitude === null) return null;
  return localizeToNagaland(latitude, longitude, location?.status === 'active' ? NAGALAND_CENTER : NAGALAND_ROUTE_POINTS.destination);
};

const buildNagalandEmbedUrl = () => {
  const bbox = [
    NAGALAND_BOUNDS.minLongitude,
    NAGALAND_BOUNDS.minLatitude,
    NAGALAND_BOUNDS.maxLongitude,
    NAGALAND_BOUNDS.maxLatitude,
  ].map((value) => value.toFixed(6)).join('%2C');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${NAGALAND_CENTER.latitude.toFixed(6)}%2C${NAGALAND_CENTER.longitude.toFixed(6)}&locale=en`;
};

const buildOpenStreetMapEmbedUrl = (location) => {
  const pairs = coordinatePairs(location);
  const marker = primaryMarker(location);
  if (!pairs.length || !marker) return buildNagalandEmbedUrl();

  const latitudes = pairs.map(([latitude]) => latitude);
  const longitudes = pairs.map(([, longitude]) => longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const padding = Math.max(0.006, Math.abs(maxLatitude - minLatitude) * 0.38, Math.abs(maxLongitude - minLongitude) * 0.38);

  const bbox = [
    minLongitude - padding,
    minLatitude - padding,
    maxLongitude + padding,
    maxLatitude + padding,
  ].map((value) => value.toFixed(6)).join('%2C');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker.latitude.toFixed(6)}%2C${marker.longitude.toFixed(6)}&locale=en`;
};

const openMapUrl = (location) => {
  const originLatitude = toFiniteNumber(location?.routeOriginLatitude);
  const originLongitude = toFiniteNumber(location?.routeOriginLongitude);
  const destinationLatitude = toFiniteNumber(location?.routeDestinationLatitude);
  const destinationLongitude = toFiniteNumber(location?.routeDestinationLongitude);
  const marker = primaryMarker(location);
  const localizedOrigin = localizeToNagaland(originLatitude, originLongitude, NAGALAND_ROUTE_POINTS.origin);
  const localizedDestination = localizeToNagaland(destinationLatitude, destinationLongitude, NAGALAND_ROUTE_POINTS.destination);

  if (originLatitude !== null && originLongitude !== null && destinationLatitude !== null && destinationLongitude !== null) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${localizedOrigin.latitude}%2C${localizedOrigin.longitude}%3B${localizedDestination.latitude}%2C${localizedDestination.longitude}&locale=en`;
  }

  if (!marker) {
    return `https://www.openstreetmap.org/?locale=en#map=8/${NAGALAND_CENTER.latitude}/${NAGALAND_CENTER.longitude}`;
  }
  return `https://www.openstreetmap.org/?locale=en&mlat=${marker.latitude}&mlon=${marker.longitude}#map=16/${marker.latitude}/${marker.longitude}`;
};

const routeLabel = (location) => {
  if (location?.routeOrigin && location?.routeDestination) {
    return `${location.routeOrigin} to ${location.routeDestination}`;
  }
  return location?.routeName || location?.driverName || 'Route assigned';
};

export default function FleetMap({ locations, accent = '#2563EB', mutedColor = '#8EA4C8', textColor = '#F8FAFC' }) {
  const activeLocations = locations.filter((location) => location.status === 'active');
  const routableLocations = locations.filter((location) => coordinatePairs(location).length > 0);
  const primaryLocation = activeLocations[0] || routableLocations[0] || null;
  const embedUrl = buildOpenStreetMapEmbedUrl(primaryLocation);
  const mapSubject = primaryLocation?.vehicleId || primaryLocation?.driverName || 'Nagaland route area';

  return (
    <View style={styles.container}>
      {embedUrl ? (
        <View style={styles.mapFrame}>
          <iframe
            aria-label={`Route map for ${mapSubject}`}
            src={embedUrl}
            style={styles.iframe}
            title={`Route map for ${mapSubject}`}
          />
          {primaryLocation?.routeOrigin || primaryLocation?.routeDestination ? (
            <View style={styles.routeOverlay} pointerEvents="none">
              <View style={[styles.routePoint, { borderColor: accent }]}>
                <Text numberOfLines={1} style={[styles.routePointLabel, { color: mutedColor }]}>From</Text>
                <Text numberOfLines={1} style={[styles.routePointValue, { color: textColor }]}>{primaryLocation.routeOrigin || 'Start'}</Text>
              </View>
              <View style={[styles.routeLine, { backgroundColor: accent }]} />
              <View style={[styles.routePoint, { borderColor: accent }]}>
                <Text numberOfLines={1} style={[styles.routePointLabel, { color: mutedColor }]}>To</Text>
                <Text numberOfLines={1} style={[styles.routePointValue, { color: textColor }]}>{primaryLocation.routeDestination || 'Destination'}</Text>
              </View>
            </View>
          ) : null}
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
            {primaryLocation.vehicleId || 'Vehicle'} {primaryLocation.status === 'active' ? 'live now' : 'route assigned'}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, styles.stripSubtitle, { color: mutedColor }]}>
            {routeLabel(primaryLocation)}
          </Text>
        </View>
      ) : null}

      {routableLocations.map((location) => (
        <TouchableOpacity
          key={location.vehicleId}
          onPress={() => Linking.openURL(openMapUrl(location))}
          style={styles.link}
        >
          <Ionicons color={accent} name={location.status === 'active' ? 'bus' : 'map-outline'} size={18} />
          <Text style={[styles.linkText, { color: accent }]}>{location.vehicleId}</Text>
        </TouchableOpacity>
      ))}
      {routableLocations.length === 0 ? <Text style={[styles.empty, { color: mutedColor }]}>No active or assigned routes are available right now.</Text> : null}
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
    position: 'relative',
    width: '100%',
  },
  routeLine: {
    borderRadius: 999,
    height: 2,
    marginHorizontal: 6,
    opacity: 0.66,
    width: 32,
  },
  routeOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 7, 18, 0.78)',
    borderRadius: 8,
    bottom: 10,
    flexDirection: 'row',
    left: 10,
    padding: 8,
    position: 'absolute',
    right: 10,
  },
  routePoint: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  routePointLabel: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  routePointValue: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
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
