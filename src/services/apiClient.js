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

const withRequestId = (message, payload = {}) => (
  payload?.requestId ? `${message} Support code: ${payload.requestId}.` : message
);

const toFriendlyApiMessage = (message, status, payload = {}) => {
  const text = String(message || '').toLowerCase();

  if (status === 400) return withRequestId(message || 'Some information is missing or formatted incorrectly. Please review the highlighted fields.', payload);
  if (status === 401 || text.includes('unauthorized') || text.includes('auth/')) {
    return withRequestId('Your session could not be verified. Sign in again and retry.', payload);
  }
  if (status === 403) return withRequestId('You do not have permission to do that from this account.', payload);
  if (status === 404) return withRequestId('We could not find the record for this institute. Check the ID and try again.', payload);
  if (status === 409) return withRequestId(message || 'This change conflicts with an existing record. Refresh and try again.', payload);
  if (status === 413) return withRequestId('That file is too large for this upload. Use a smaller file and try again.', payload);
  if (status === 429) return withRequestId('Too many attempts right now. Wait a moment, then try again.', payload);
  if (status >= 500) return withRequestId('Shii-Edu could not finish that request. Please try again in a moment.', payload);
  if (text.includes('network') || text.includes('failed to fetch')) {
    return withRequestId('The connection dropped before Shii-Edu could respond. Check your internet and try again.', payload);
  }

  return withRequestId(message || 'Something went wrong. Please try again.', payload);
};

export const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const windowOrigin = trimTrailingSlash(window.location.origin);
    const trimmedConfiguredUrl = configuredUrl ? trimTrailingSlash(configuredUrl) : '';

    if (
      !trimmedConfiguredUrl
      || isLocalApiBase(windowOrigin)
      || trimmedConfiguredUrl === DEFAULT_PRODUCTION_API_BASE_URL
      || trimmedConfiguredUrl === windowOrigin
    ) {
      return windowOrigin;
    }

    return trimmedConfiguredUrl;
  }

  if (configuredUrl) {
    const trimmedUrl = trimTrailingSlash(configuredUrl);
    if (!(Platform.OS === 'web' && !isDev && isLocalApiBase(trimmedUrl))) {
      return trimmedUrl;
    }
  }

  if (isDev) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
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

  const {
    body: rawBody,
    headers: customHeaders = {},
    retryCount = 1,
    timeoutMs = 30000,
    ...fetchOptions
  } = options;
  const token = await currentUser.getIdToken();
  const body = rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string'
    ? JSON.stringify(rawBody)
    : rawBody;
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
    Authorization: `Bearer ${token}`,
  };
  const url = `${getApiBaseUrl()}${path}`;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        headers,
        body,
      }, timeoutMs);

      const data = await parseResponse(response);

      if (response.ok) return data;

      const message = toFriendlyApiMessage(data.error || `Request failed with status ${response.status}.`, response.status, data);
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
        throw new Error(`Could not reach the Shii-Edu API at ${url}. Please try again.`);
      }

      throw error;
    }
  }

  throw new Error('Request failed.');
};
