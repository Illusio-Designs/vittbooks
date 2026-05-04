const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../config/env');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
function initSocketServer(server) {
  // Get main domain from environment or default to fintranzact.com
  const mainDomain = process.env.MAIN_DOMAIN || process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'fintranzact.com';
  
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // List of allowed origins
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN,
        // Localhost origins
        'http://localhost:3000',
        'http://localhost:3001',
        'http://admin.localhost:3000',
        'http://admin.localhost:3001',
        'http://client.localhost:3000',
        'http://client.localhost:3001',
        // Production origins - main domain
        `https://${mainDomain}`,
        `http://${mainDomain}`,
        `https://www.${mainDomain}`,
        `http://www.${mainDomain}`,
        // Production origins - admin subdomain
        `https://admin.${mainDomain}`,
        `http://admin.${mainDomain}`,
        // Production origins - client subdomain
        `https://client.${mainDomain}`,
        `http://client.${mainDomain}`,
      ].filter(Boolean);
      
      // Allow all localhost subdomains in development
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin) ||
                          /^https?:\/\/.*\.localhost(:\d+)?$/.test(origin);
      
      // Check if origin matches production domain pattern (with or without subdomain)
      const isProductionDomain = new RegExp(`^https?://(www\\.)?(admin|client)?\\.?${mainDomain.replace(/\./g, '\\.')}$`).test(origin);
      
      if (allowedOrigins.includes(origin) || isLocalhost || isProductionDomain || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  };

  io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verify user exists
      const user = await User.findByPk(decoded.id || decoded.user_id);
      if (!user || !user.is_active) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = decoded.id || decoded.user_id;
      socket.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.userId}`);

    // Join user-specific room
    socket.on('join-user-room', (userId) => {
      if (socket.userId === userId) {
        const roomName = `user:${userId}`;
        socket.join(roomName);
        logger.info(`User ${userId} joined room: ${roomName}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.userId}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO server instance
 * @returns {Server|null} Socket.IO server instance
 */
function getSocketServer() {
  return io;
}

/**
 * Send notification to user via WebSocket
 * @param {string} userId - User ID
 * @param {Object} notification - Notification object
 */
function sendNotificationToUser(userId, notification) {
  if (!io) {
    logger.warn('Socket.IO server not initialized');
    return;
  }

  const roomName = `user:${userId}`;
  io.to(roomName).emit('new_notification', notification);
  logger.info(`Sent notification to user ${userId} via WebSocket`);
}

/**
 * Send notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notification - Notification object
 */
function sendNotificationToUsers(userIds, notification) {
  if (!io) {
    logger.warn('Socket.IO server not initialized');
    return;
  }

  userIds.forEach((userId) => {
    sendNotificationToUser(userId, notification);
  });
}

module.exports = {
  initSocketServer,
  getSocketServer,
  sendNotificationToUser,
  sendNotificationToUsers,
};
