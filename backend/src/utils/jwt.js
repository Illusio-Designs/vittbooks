const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../config/redis');
const logger = require('./logger');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../config/env');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Sign JWT tokens (access and refresh)
 * @param {Object} userData - User data to encode in token
 * @returns {Promise<Object>} Object with accessToken, refreshToken, and jti
 */
async function signTokens(userData) {
  const jti = uuidv4(); // JWT ID for session management

  const payload = {
    id: userData.id,
    user_id: userData.id, // Alias for compatibility
    sub: userData.id, // Standard JWT subject
    tenant_id: userData.tenant_id,
    company_id: userData.company_id || null,
    role: userData.role,
    jti: jti,
  };

  // Generate access token
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  // Generate refresh token (longer expiry)
  const refreshToken = jwt.sign(
    { id: userData.id, tenant_id: userData.tenant_id, jti: jti },
    JWT_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    }
  );

  // Store session in Redis
  const sessionKey = `session:${userData.id}:${jti}`;
  const sessionData = {
    user_id: userData.id,
    tenant_id: userData.tenant_id,
    company_id: userData.company_id || null,
    role: userData.role,
    created_at: new Date().toISOString(),
  };

  try {
    // Store session with expiry matching refresh token expiry (7 days)
    const expirySeconds = 7 * 24 * 60 * 60; // 7 days in seconds
    await redisClient.setEx(sessionKey, expirySeconds, JSON.stringify(sessionData));
  } catch (error) {
    // Continue even if Redis fails (graceful degradation)
    if (redisClient.isConnected()) {
      logger.error('Failed to store session in Redis:', error);
    }
  }

  return {
    accessToken,
    refreshToken,
    jti,
  };
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token');
    } else {
      logger.error('Token verification error:', error);
    }
    return null;
  }
}

/**
 * Get session from Redis
 * @param {string} userId - User ID
 * @param {string} jti - JWT ID
 * @returns {Promise<Object|null>} Session data or null
 */
async function getSession(userId, jti) {
  try {
    const sessionKey = `session:${userId}:${jti}`;
    const session = await redisClient.get(sessionKey);
    return session ? JSON.parse(session) : null;
  } catch (error) {
    // If Redis is not connected, return null (session validation will be skipped)
    if (redisClient.isConnected()) {
      logger.error('Failed to get session from Redis:', error);
    }
    return null;
  }
}

/**
 * Revoke session (logout)
 * @param {string} userId - User ID
 * @param {string} jti - JWT ID
 * @returns {Promise<boolean>} Success status
 */
async function revokeSession(userId, jti) {
  try {
    const sessionKey = `session:${userId}:${jti}`;
    await redisClient.del(sessionKey);
    if (redisClient.isConnected()) {
      logger.info(`Session revoked for user ${userId}, jti ${jti}`);
    }
    return true;
  } catch (error) {
    if (redisClient.isConnected()) {
      logger.error('Failed to revoke session from Redis:', error);
    }
    return false;
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object|null>} New tokens or null if invalid
 */
async function refreshAccessToken(refreshToken) {
  try {
    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return null;
    }

    let session = null;
    try {
      session = await getSession(decoded.id, decoded.jti);
    } catch (error) {
      logger.warn('Redis error during refresh token validation:', error.message);
    }

    // If Redis is connected but no session is recorded, treat the refresh
    // token as revoked (logout / admin reset / rotation already consumed it).
    if (redisClient.isConnected() && !session) {
      logger.warn(`Session not found for refresh token, user ${decoded.id}, jti ${decoded.jti}`);
      return null;
    }

    const { User } = require('../models');
    const user = await User.findByPk(decoded.id);
    if (!user) {
      logger.warn(`User not found for refresh token: ${decoded.id}`);
      return null;
    }

    // Refresh token rotation: invalidate the old jti and issue a brand
    // new pair. A leaked refresh token can therefore only be replayed once
    // before being detected (legitimate user's next refresh will fail).
    await revokeSession(decoded.id, decoded.jti);

    const fresh = await signTokens({
      id: user.id,
      tenant_id: decoded.tenant_id,
      company_id: session?.company_id || decoded.company_id || null,
      role: user.role,
    });

    return {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      jti: fresh.jti,
    };
  } catch (error) {
    logger.error('Failed to refresh token:', error);
    return null;
  }
}

module.exports = {
  signTokens,
  verifyToken,
  getSession,
  revokeSession,
  refreshAccessToken,
};
