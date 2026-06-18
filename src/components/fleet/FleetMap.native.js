import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_REGION = {
  latitude: 25.6751,
  longitude: 94.1086,
  latitudeDelta: 2.2,
  longitudeDelta: 2.2,
};

const NAGALAND_BOUNDS = {
  maxLatitude: 26.95,
  maxLongitude: 95.25,
  minLatitude: 25.15,
  minLongitude: 93.3,
};

const NAGALAND_ROUTE_POINTS = {
  destination: {
    latitude: 25.9063,
    longitude: 93.7276,
  },
  origin: {
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  },
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

const localizeToNagaland = (latitude, longitude, fallback = NAGALAND_ROUTE_POINTS.origin) => (
  isNagalandCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : fallback
);

const routeCoordinates = (location) => {
  const originLatitude = toFiniteNumber(location.routeOriginLatitude);
  const originLongitude = toFiniteNumber(location.routeOriginLongitude);
  const destinationLatitude = toFiniteNumber(location.routeDestinationLatitude);
  const destinationLongitude = toFiniteNumber(location.routeDestinationLongitude);
  if (originLatitude === null || originLongitude === null || destinationLatitude === null || destinationLongitude === null) return [];
  const origin = localizeToNagaland(originLatitude, originLongitude, NAGALAND_ROUTE_POINTS.origin);
  const destination = localizeToNagaland(destinationLatitude, destinationLongitude, NAGALAND_ROUTE_POINTS.destination);
  return [
    origin,
    destination,
  ];
};

const markerCoordinate = (location) => {
  const latitude = toFiniteNumber(location.status === 'active' ? location.latitude : location.routeDestinationLatitude ?? location.latitude);
  const longitude = toFiniteNumber(location.status === 'active' ? location.longitude : location.routeDestinationLongitude ?? location.longitude);
  if (latitude === null || longitude === null) return null;
  return localizeToNagaland(latitude, longitude, location.status === 'active' ? NAGALAND_ROUTE_POINTS.origin : NAGALAND_ROUTE_POINTS.destination);
};

function AnimatedVehicleMarker({ location, accent }) {
  const marker = markerCoordinate(location);
  const coordinate = useRef(new AnimatedRegion({
    latitude: marker?.latitude || DEFAULT_REGION.latitude,
    longitude: marker?.longitude || DEFAULT_REGION.longitude,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;

  useEffect(() => {
    if (!marker) return;
    coordinate.timing({
      latitude: marker.latitude,
      longitude: marker.longitude,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [coordinate, marker]);

  if (!marker) return null;

  return (
    <Marker.Animated
      coordinate={coordinate}
      description={location.routeName || location.driverName}
      title={location.vehicleId}
    >
      <View style={[styles.marker, { backgroundColor: location.status === 'active' ? accent : '#475569' }]}>
        <Ionicons color="#FFFFFF" name={location.status === 'active' ? 'bus' : 'flag'} size={18} />
      </View>
    </Marker.Animated>
  );
}

export default function FleetMap({ locations, accent = '#2563EB', mutedColor = '#8EA4C8' }) {
  const activeLocations = useMemo(
    () => locations.filter((location) => location.status === 'active'),
    [locations]
  );
  const routableLocations = useMemo(
    () => (activeLocations.length > 0 ? activeLocations : locations.filter((location) => markerCoordinate(location))),
    [activeLocations, locations]
  );
  const firstMarker = markerCoordinate(routableLocations[0] || {});
  const initialRegion = firstMarker
    ? {
      latitude: firstMarker.latitude,
      longitude: firstMarker.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }
    : DEFAULT_REGION;

  if (routableLocations.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons color={mutedColor} name="map-outline" size={34} />
        <Text style={[styles.emptyText, { color: mutedColor }]}>No active or assigned routes are available right now.</Text>
      </View>
    );
  }

  return (
    <MapView initialRegion={initialRegion} style={StyleSheet.absoluteFill}>
      {routableLocations.map((location) => {
        const route = routeCoordinates(location);
        return route.length === 2 ? (
          <React.Fragment key={`${location.vehicleId}-route`}>
            <Polyline coordinates={route} strokeColor={accent} strokeWidth={4} />
            <Marker coordinate={route[0]} description={location.routeOrigin || 'Start'} title="Start" />
            <Marker coordinate={route[1]} description={location.routeDestination || 'Destination'} title="Destination" />
          </React.Fragment>
        ) : null;
      })}
      {routableLocations.map((location) => (
        <AnimatedVehicleMarker accent={accent} key={location.vehicleId} location={location} />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  marker: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
