import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 16,
  longitudeDelta: 16,
};

function AnimatedVehicleMarker({ location, accent }) {
  const coordinate = useRef(new AnimatedRegion({
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;

  useEffect(() => {
    coordinate.timing({
      latitude: location.latitude,
      longitude: location.longitude,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [coordinate, location.latitude, location.longitude]);

  return (
    <Marker.Animated
      coordinate={coordinate}
      description={location.routeName || location.driverName}
      title={location.vehicleId}
    >
      <View style={[styles.marker, { backgroundColor: accent }]}>
        <Ionicons color="#FFFFFF" name="bus" size={18} />
      </View>
    </Marker.Animated>
  );
}

export default function FleetMap({ locations, accent = '#2563EB', mutedColor = '#8EA4C8' }) {
  const activeLocations = useMemo(
    () => locations.filter((location) => location.status === 'active'),
    [locations]
  );
  const initialRegion = activeLocations.length > 0
    ? {
      latitude: activeLocations[0].latitude,
      longitude: activeLocations[0].longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }
    : DEFAULT_REGION;

  if (activeLocations.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons color={mutedColor} name="map-outline" size={34} />
        <Text style={[styles.emptyText, { color: mutedColor }]}>No active vehicles are broadcasting right now.</Text>
      </View>
    );
  }

  return (
    <MapView initialRegion={initialRegion} style={StyleSheet.absoluteFill}>
      {activeLocations.map((location) => (
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
