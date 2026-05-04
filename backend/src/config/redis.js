require('dotenv').config();
const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;

// Only create Redis client if Redis is enabled
if (process.env.REDIS_ENABLED !== 'false') {
  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.warn('Redis: Max reconnection attempts reached. Continuing without Redis.');
          return false; // Stop trying to reconnect
        }
        return Math.min(retries * 100, 3000); // Exponential backoff, max 3 seconds
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  redisClient.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      logger.error('Redis Client Error:', err);
    }
    isConnected = false;
  });

  redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
    isConnected = true;
  });

  redisClient.on('ready', () => {
    logger.info('Redis Client Ready');
    isConnected = true;
  });

  redisClient.on('end', () => {
    logger.warn('Redis Client Disconnected');
    isConnected = false;
  });

  // Connect to Redis (non-blocking)
  (async () => {
    try {
      await redisClient.connect();
      logger.info('Redis connection established');
      isConnected = true;
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        logger.warn('Redis not available. Server will continue without Redis session management.');
        logger.warn('To disable Redis warnings, set REDIS_ENABLED=false in .env');
      } else {
        logger.error('Redis connection failed:', err);
      }
      isConnected = false;
    }
  })();
} else {
  logger.info('Redis is disabled (REDIS_ENABLED=false)');
}

// Wrapper functions to handle Redis being unavailable
const redisWrapper = {
  async get(key) {
    if (!redisClient || !isConnected) return null;
    try {
      return await redisClient.get(key);
    } catch (err) {
      logger.warn('Redis get failed:', err.message);
      return null;
    }
  },

  async set(key, value, options = {}) {
    if (!redisClient || !isConnected) return false;
    try {
      if (options.EX) {
        await redisClient.setEx(key, options.EX, value);
      } else {
        await redisClient.set(key, value);
      }
      return true;
    } catch (err) {
      logger.warn('Redis set failed:', err.message);
      return false;
    }
  },

  async setEx(key, seconds, value) {
    if (!redisClient || !isConnected) return false;
    try {
      await redisClient.setEx(key, seconds, value);
      return true;
    } catch (err) {
      logger.warn('Redis setEx failed:', err.message);
      return false;
    }
  },

  async del(key) {
    if (!redisClient || !isConnected) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      logger.warn('Redis del failed:', err.message);
      return false;
    }
  },

  async quit() {
    if (!redisClient || !isConnected) return;
    try {
      await redisClient.quit();
      isConnected = false;
    } catch (err) {
      logger.warn('Redis quit failed:', err.message);
    }
  },

  isConnected() {
    return isConnected;
  },

  /**
   * Run a raw Redis command. Required by `rate-limit-redis` and any other
   * library that needs to issue arbitrary commands against the underlying
   * node-redis v4 client. Throws if Redis is not connected — callers are
   * expected to check isConnected() first or handle the rejection.
   */
  async sendCommand(args) {
    if (!redisClient || !isConnected) {
      throw new Error('Redis not connected');
    }
    return redisClient.sendCommand(args);
  },

  /**
   * Delete every key matching a pattern. Used to revoke all sessions for a
   * given user (e.g. after a password reset). Uses SCAN under the hood so
   * it does not block Redis on large keyspaces. Safe no-op when offline.
   */
  async deletePattern(pattern) {
    if (!redisClient || !isConnected) return 0;
    try {
      let count = 0;
      for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 200 })) {
        await redisClient.del(key);
        count += 1;
      }
      return count;
    } catch (err) {
      logger.warn('Redis deletePattern failed:', err.message);
      return 0;
    }
  },
};

module.exports = redisWrapper;
