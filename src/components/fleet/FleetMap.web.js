import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FleetMap({ locations, accent = '#2563EB', mutedColor = '#8EA4C8', textColor = '#F8FAFC' }) {
  const activeLocations = locations.filter((location) => location.status === 'active');

  return (
    <View style={styles.container}>
      <Ionicons color={accent} name="map-outline" size={34} />
      <Text style={[styles.title, { color: textColor }]}>Live vehicle coordinates</Text>
      <Text style={[styles.subtitle, { color: mutedColor }]}>Open an active vehicle in your preferred map application.</Text>
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
    justifyContent: 'center',
    padding: 24,
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
});
