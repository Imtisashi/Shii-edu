import { Platform } from 'react-native';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isLocalApiBase = (value) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(value);
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://shii-edu.vercel.app';

class ApiError extends Error {
  constructor(message, status, payload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

  if (configuredUrl) {
    const trimmedUrl = trimTrailingSlash(configuredUrl);
    if (!(Platform.OS === 'web' && !isDev && isLocalApiBase(trimmedUrl))) {
      return trimmedUrl;
    }
  }

  if (isDev) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const windowOrigin = trimTrailingSlash(window.location.origin);
    return isLocalApiBase(windowOrigin) ? DEFAULT_PRODUCTION_API_BASE_URL : windowOrigin;
  }

  return DEFAULT_PRODUCTION_API_BASE_URL;
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { error: text };
  }
};

const fetchWithTimeout = async (url, options, timeoutMs) => {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const authenticatedFetch = async (path, currentUser, options = {}) => {
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }

  const token = await currentUser.getIdToken();
  const body = options.body && typeof options.body !== 'string'
    ? JSON.stringify(options.body)
    : options.body;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const timeoutMs = options.timeoutMs || 30000;
  const retryCount = options.retryCount ?? 1;
  const url = `${getApiBaseUrl()}${path}`;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers,
        body,
      }, timeoutMs);

      const data = await parseResponse(response);

      if (response.ok) return data;

      const message = data.error || `Request failed with status ${response.status}.`;
      if (response.status >= 500 && attempt < retryCount) {
        await wait(450 * (attempt + 1));
        continue;
      }

      throw new ApiError(message, response.status, data);
    } catch (error) {
      const isAbort = error.name === 'AbortError';
      const canRetry = (isAbort || error.status >= 500 || !error.status) && attempt < retryCount;

      if (canRetry) {
        await wait(450 * (attempt + 1));
        continue;
      }

      if (isAbort) {
        throw new Error('The server took too long to respond. Please try again.');
      }

      if (!error.status) {
        console.error('[apiClient] Request could not reach the API.', {
          message: error.message,
          path,
          url,
        });
        throw new Error(`Could not reach the Edu-Hub API at ${url}. Please try again.`);
      }

      throw error;
    }
  }

  throw new Error('Request failed.');
};
