import { Platform } from 'react-native';

let performanceMonitoringInitialized = false;

export const installMobilePerformanceMonitoring = () => {
  // Only initialize once
  if (performanceMonitoringInitialized) return;

  // Only initialize on mobile platforms (not web)
  if (Platform.OS === 'web') return;

  // Check if we're in a reasonable environment (not during tests, etc.)
  if (typeof global.__expo === 'undefined') {
    // Might be running in a test environment or SSR
    return;
  }

  try {
    // Import Firebase modules dynamically to avoid issues if Firebase is not fully initialized
    const { getApp } = require('firebase/app');
    const { getPerformance } = require('firebase/performance');

    // Check if Firebase app is already initialized
    try {
      const app = getApp();

      // Initialize Performance Monitoring
      const performance = getPerformance(app);

      // Optional: Disable performance monitoring in development if desired
      // if (__DEV__) {
      //   performance.dataCollectionEnabled = false;
      // }

      performanceMonitoringInitialized = true;
      console.log('Firebase Performance Monitoring initialized for mobile');
    } catch (firebaseError) {
      // Firebase app not initialized yet
      console.warn('Firebase app not initialized, skipping Performance Monitoring initialization');
    }
  } catch (error) {
    console.warn('Failed to initialize Firebase Performance Monitoring:', error);
    // Don't fail the app if performance monitoring can't be initialized
  }
};