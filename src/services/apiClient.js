import { Platform } from 'react-native';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configuredUrl) return trimTrailingSlash(configuredUrl);

  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
  }

  throw new Error('Missing EXPO_PUBLIC_API_BASE_URL for production API calls.');
};

export const authenticatedFetch = async (path, currentUser, options = {}) => {
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }

  const token = await currentUser.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
};
