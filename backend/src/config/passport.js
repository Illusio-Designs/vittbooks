/**
 * Passport Configuration
 * Google OAuth Strategy setup
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');
const logger = require('../utils/logger');

// Google OAuth credentials from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

// Get main domain for callback URL construction
const getCallbackURL = () => {
  // If explicitly set in environment, use it
  if (process.env.GOOGLE_CALLBACK_URL && process.env.GOOGLE_CALLBACK_URL.startsWith('http')) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  
  const mainDomain = process.env.MAIN_DOMAIN || process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'finvera.solutions';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const port = process.env.PORT || 3000;
  
  if (process.env.NODE_ENV === 'production') {
    // Use API subdomain or main domain
    const apiDomain = process.env.API_DOMAIN || `api.${mainDomain}`;
    return `${protocol}://${apiDomain}${GOOGLE_CALLBACK_URL}`;
  }
  
  return `${protocol}://localhost:${port}${GOOGLE_CALLBACK_URL}`;
};

// Configure Google OAuth Strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: getCallbackURL(),
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const { id, displayName, emails, photos } = profile;
          const email = emails && emails[0] ? emails[0].value : null;
          const profileImage = photos && photos[0] ? photos[0].value : null;

          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          // Trust Google's "email_verified" claim. If Google itself has
          // not verified ownership of the email address, an attacker
          // could create a Google account for someone else's email and
          // hijack the account here. Reject such logins outright.
          const emailVerified =
            (emails && emails[0] && emails[0].verified === true) ||
            (profile._json && profile._json.email_verified === true) ||
            (profile._json && profile._json.email_verified === 'true');
          if (!emailVerified) {
            logger.warn(`Google login rejected: email not verified (${email})`);
            return done(new Error('Google email is not verified'), null);
          }

          const normalizedEmail = email.toLowerCase().trim();

          // 1. Try to find by google_id (already linked).
          let user = await User.findOne({ where: { google_id: id } });

          // 2. If not, look up by email — but DO NOT auto-link silently.
          //    Auto-linking by matching email is the classic OAuth account
          //    takeover: anyone able to register that email at Google could
          //    take over an existing password-based account. Instead, we
          //    refuse and ask the user to log in with their password and
          //    link Google from settings (i.e. while authenticated).
          if (!user) {
            const existing = await User.findOne({ where: { email: normalizedEmail } });
            if (existing) {
              logger.warn(
                `Google login refused — email ${normalizedEmail} already exists as a non-Google account`
              );
              return done(
                new Error(
                  'An account with this email already exists. Please sign in with your password and link Google from your profile settings.'
                ),
                null
              );
            }
          }

          // If user still doesn't exist, check if there's a tenant with this email
          if (!user) {
            const masterModels = require('../models/masterModels');
            let tenant = await masterModels.TenantMaster.findOne({ 
              where: { email: normalizedEmail } 
            });

            // If no tenant exists, create one for the new Google user
            if (!tenant) {
              const companyName = displayName || email.split('@')[0];
              
              // Generate a unique subdomain based on email
              const baseSubdomain = normalizedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
              let subdomain = baseSubdomain;
              let subdomainExists = await masterModels.TenantMaster.findOne({ where: { subdomain } });
              let counter = 1;
              
              // Keep trying until we find a unique subdomain
              while (subdomainExists) {
                subdomain = `${baseSubdomain}${counter}`;
                subdomainExists = await masterModels.TenantMaster.findOne({ where: { subdomain } });
                counter++;
              }

              // Set trial period (30 days from now)
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + 30);

              tenant = await masterModels.TenantMaster.create({
                email: normalizedEmail,
                company_name: companyName,
                subdomain: subdomain,
                is_trial: true,
                trial_ends_at: trialEnd,
                subscription_plan: 'trial',
                acquisition_category: 'organic',
                is_active: true,
              });
              logger.info(`New tenant created for Google user: ${normalizedEmail}, tenant_id: ${tenant.id}, subdomain: ${subdomain}`);
            }

            // Create user with tenant_id
            user = await User.create({
              email: normalizedEmail,
              google_id: id,
              name: displayName || email.split('@')[0],
              password: null, // No password for OAuth users
              profile_image: profileImage,
              role: 'tenant_admin', // All Google signups are tenant admins
              tenant_id: tenant.id,
              is_active: true,
            });

            logger.info(`New user created via Google OAuth: ${user.email}, tenant_id: ${user.tenant_id}`);
          } else {
            // Update last login
            user.last_login = new Date();
            if (profileImage && !user.profile_image) {
              user.profile_image = profileImage;
            }
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          logger.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  logger.info('Google OAuth strategy configured');
} else {
  logger.warn('Google OAuth credentials not found. Google login will be disabled.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
