// src/lib/cache.js
// A caching layer that uses Vercel Edge Config in production and an in-memory cache in development.

// In development, we use a simple Map.
// In production, we use @vercel/edge-config if available.

let cache = null;

// Initialize the cache based on the environment.
function initializeCache() {
  if (process.env.NODE_ENV === 'production') {
    try {
      // Attempt to use Vercel Edge Config.
      const { EdgeConfig } = require('@vercel/edge-config');
      // The Edge Config SDK requires an EDGE_CONFIG environment variable.
      // This is automatically set in Vercel Edge Functions and Serverless Functions when Edge Config is linked.
      if (process.env.EDGE_CONFIG) {
        cache = new EdgeConfig(process.env.EDGE_CONFIG);
        return;
      }
    } catch (e) {
      // If Edge Config is not available, fall back to memory.
      console.warn('Vercel Edge Config not available, falling back to in-memory cache');
    }
  }
  // Fallback: in-memory cache.
  cache = new Map();
}

initializeCache();

/**
 * Get a value from the cache.
 * @param {string} key - The key to retrieve.
 * @returns {Promise<any>} The cached value or null if not found.
 */
export async function get(key) {
  if (cache instanceof Map) {
    const value = cache.get(key);
    // In-memory cache doesn't have expiration by default, but we can store { value, expiry }.
    if (value && value.expiry && Date.now() > value.expiry) {
      cache.delete(key);
      return null;
    }
    return value ? value.value : null;
  } else {
    // Edge Config returns null if the key doesn't exist.
    return await cache.get(key);
  }
}

/**
 * Set a value in the cache.
 * @param {string} key - The key to store.
 * @param {any} value - The value to store.
 * @param {number} ttl - Time to live in seconds (optional).
 */
export async function set(key, value, ttl) {
  if (cache instanceof Map) {
    const item = {
      value,
      expiry: ttl ? Date.now() + ttl * 1000 : null,
    };
    cache.set(key, item);
  } else {
    // Edge Config: we can set with options (including TTL?).
    // Note: Edge Config does not natively support TTL. We would need to implement our own expiration.
    // For simplicity, we'll ignore TTL for Edge Config and rely on the application to handle expiry.
    // Alternatively, we can store the expiry time with the value and check on get.
    // Let's do that: store { value, expiry } as a JSON string.
    const item = {
      value,
      expiry: ttl ? Date.now() + ttl * 1000 : null,
    };
    await cache.set(key, JSON.stringify(item));
  }
}

/**
 * Delete a key from the cache.
 * @param {string} key - The key to delete.
 */
export async function remove(key) {
  if (cache instanceof Map) {
    cache.delete(key);
  } else {
    await cache.delete(key);
  }
}

/**
 * Clear the entire cache.
 */
export async function clear() {
  if (cache instanceof Map) {
    cache.clear();
  } else {
    // Edge Config does not have a clear method. We would need to delete all keys.
    // For simplicity, we'll not implement clear for Edge Config.
    // Alternatively, we can reset by reinitializing? Not possible.
    // We'll log a warning.
    console.warn('Clear operation not supported for Edge Config cache');
  }
}

// Export the initializeCache function for testing or reinitialization.
export { initializeCache };