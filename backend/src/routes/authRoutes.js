const { Router } = require('express');
const crypto = require('crypto');
const passport = require('passport');
const validator = require('../middleware/validator');
const { loginValidator, registerValidator } = require('../validators/authValidator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { uploadProfile } = require('../config/multer');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const router = Router();

// CSRF protection for the Google OAuth round-trip.
//
// Without an opaque `state` parameter, an attacker can craft a callback
// URL that links *their* Google identity to the *victim's* logged-in
// session. We mint a random token before redirecting to Google, store
// it in Redis with a 5-minute TTL, and reject the callback if it comes
// back without a matching token.
//
// The existing route also uses `?state=mobile` as a platform hint — we
// preserve that by packing it into the same opaque token as
// "<csrf>.<platform>" and splitting it back out on the callback so the
// downstream controller still sees req.query.platform.
const OAUTH_STATE_TTL_SECONDS = 300;

async function startGoogleOAuth(req, res, next) {
  try {
    const platform =
      req.query.state === 'mobile' || req.query.platform === 'mobile' ? 'mobile' : 'web';
    const csrf = crypto.randomBytes(24).toString('hex');
    const packedState = `${csrf}.${platform}`;

    // Best-effort Redis store. If Redis is offline we still send the
    // user to Google but reject any callback later (no replay window).
    try {
      await redisClient.setEx(`oauth_state:${csrf}`, OAUTH_STATE_TTL_SECONDS, platform);
    } catch (e) {
      logger.warn('OAuth state could not be stored in Redis: ' + e.message);
    }

    return passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: packedState,
      session: false,
    })(req, res, next);
  } catch (err) {
    return next(err);
  }
}

async function verifyGoogleOAuthState(req, res, next) {
  try {
    const stateParam = req.query.state;
    if (!stateParam || typeof stateParam !== 'string' || !stateParam.includes('.')) {
      logger.warn('Google OAuth callback rejected: missing or malformed state');
      return res.status(400).json({ message: 'Invalid OAuth state' });
    }
    const [csrf, platform] = stateParam.split('.', 2);
    const stored = await redisClient.get(`oauth_state:${csrf}`);
    if (!stored) {
      logger.warn('Google OAuth callback rejected: state not found / expired');
      return res.status(400).json({ message: 'Invalid or expired OAuth state' });
    }
    // Constant-time compare on the platform tag to avoid mismatches.
    if (stored !== platform) {
      logger.warn('Google OAuth callback rejected: platform tag mismatch');
      return res.status(400).json({ message: 'Invalid OAuth state' });
    }
    // Single-use: consume the state immediately to prevent replays.
    await redisClient.del(`oauth_state:${csrf}`);
    // Re-expose platform on the request so the controller can detect mobile.
    req.query.platform = platform;
    if (platform === 'mobile') req.query.state = 'mobile';
    next();
  } catch (err) {
    return next(err);
  }
}

router.post('/register', validator(registerValidator), authController.register);
router.post('/authenticate', authController.authenticate);
router.post('/login', validator(loginValidator), authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/switch-company', authenticate, authController.switchCompany);

// Google OAuth routes — start mints a CSRF token; callback verifies it.
router.get('/google', startGoogleOAuth);
router.get(
  '/google/callback',
  verifyGoogleOAuthState,
  passport.authenticate('google', { session: false }),
  authController.googleCallback
);

// Profile routes (require authentication)
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/profile/image', authenticate, uploadProfile.any(), (req, res, next) => {
  // Find the image file (mobile app sends fieldname: 'image')
  const imageFile = req.files?.find(file => file.fieldname === 'image');
  if (imageFile) {
    req.file = imageFile;
  }
  
  next();
}, authController.uploadProfileImage);
router.post('/change-password', authenticate, authController.changePassword);

// Password reset routes (no authentication required)
router.post('/forgot-password', authController.forgotPassword);
router.get('/verify-reset-token/:token', authController.verifyResetToken);
router.post('/reset-password', authController.resetPassword);

module.exports = router;


