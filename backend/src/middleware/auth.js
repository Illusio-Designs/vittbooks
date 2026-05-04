const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../config/env');

/**
 * JWT Authentication Middleware
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Authentication failed: No token provided for ${req.method} ${req.path}`);
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token is in Redis (session validation) - optional if Redis is not available
    const userId = decoded.user_id || decoded.id || decoded.sub;
    const sessionKey = `session:${userId}:${decoded.jti}`;
    let session = null;
    
    try {
      session = await redisClient.get(sessionKey);
    } catch (redisError) {
      // If Redis error occurs, log but continue (graceful degradation)
      if (redisClient.isConnected()) {
        logger.warn('Redis error during session check:', redisError.message);
      }
    }

    // If Redis is not available, fall back to JWT-only validation
    // (graceful degradation when the cache is offline).
    if (!redisClient.isConnected()) {
      logger.debug('Redis not available - skipping session validation for user:', userId);
    } else if (!session) {
      // Redis is up but the session record is gone — the user logged out
      // or an admin revoked the session. Reject the request.
      logger.warn(
        `Session not found for user ${userId}, jti ${decoded.jti} — rejecting request`
      );
      return res.status(401).json({
        success: false,
        message: 'Session expired or revoked. Please login again.',
      });
    }

    // Attach user info to request (handle multiple field names)
    req.user = decoded;
    req.user_id = decoded.user_id || decoded.id || decoded.sub;
    req.tenant_id = decoded.tenant_id || null;
    req.company_id = decoded.company_id || null;
    req.role = decoded.role;

    // Log authentication success for debugging
    logger.debug(`User authenticated: ${req.user_id}, role: ${req.role}, tenant_id: ${req.tenant_id || 'none'}`);

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // If Redis is available, check session; otherwise just verify JWT
      if (redisClient.isConnected()) {
        const sessionKey = `session:${decoded.user_id}:${decoded.jti}`;
        const session = await redisClient.get(sessionKey);
        if (session) {
          req.user = decoded;
          req.user_id = decoded.user_id || decoded.id || decoded.sub;
          req.tenant_id = decoded.tenant_id;
        req.company_id = decoded.company_id;
          req.role = decoded.role;
        }
      } else {
        // Redis not available, just use JWT
        req.user = decoded;
        req.user_id = decoded.user_id || decoded.id || decoded.sub;
        req.tenant_id = decoded.tenant_id;
        req.company_id = decoded.company_id;
        req.role = decoded.role;
      }
    }
    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};
