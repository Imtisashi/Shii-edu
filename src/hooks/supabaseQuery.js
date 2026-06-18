// src/hooks/supabaseQuery.js
// A custom hook for Supabase queries with caching using SWR and our cache layer.

import useSWR from 'swr';
import { get, set } from '@/src/lib/cache.js';

/**
 * Custom hook for Supabase queries with caching.
 * @param {string} key - The SWR key (should be unique for the query).
 * @param {Function} supabaseFn - A function that performs the Supabase query and returns a Promise.
 * @param {Object} options - SWR options.
 * @param {number} options.cacheTTL - Time to live for the cache in seconds (default: 60).
 * @returns {Object} SWR response (data, error, isLoading, mutate).
 */
export default function useSupabaseQuery(key, supabaseFn, options = {}) {
  const { cacheTTL = 60, ...swrOptions } = options;

  // The fetcher function for SWR.
  const fetcher = async (...args) => {
    // Try to get from cache first.
    const cached = await get(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, execute the Supabase function.
    const data = await supabaseFn(...args);

    // Store in cache.
    await set(key, data, cacheTTL);

    return data;
  };

  // Use SWR with our fetcher.
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, swrOptions);

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Helper function to create a cached Supabase query function.
 * @param {Function} supabaseFn - The original Supabase function.
 * @param {string} key - The cache key.
 * @param {number} ttl - Cache TTL in seconds.
 * @returns {Function} A wrapped function that caches the result.
 */
export function cachedSupabaseQuery(supabaseFn, key, ttl = 60) {
  return async function (...args) {
    const cached = await get(key);
    if (cached !== null) {
      return cached;
    }
    const data = await supabaseFn(...args);
    await set(key, data, ttl);
    return data;
  };
}