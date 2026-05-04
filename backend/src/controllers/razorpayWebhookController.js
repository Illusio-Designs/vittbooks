const crypto = require('crypto');
const razorpayService = require('../services/razorpayService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

module.exports = {
  /**
   * Handle Razorpay webhook events
   */
  async handleWebhook(req, res, next) {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.error('Razorpay webhook secret not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      const razorpaySignature = req.headers['x-razorpay-signature'];
      if (!razorpaySignature) {
        return res.status(400).json({ error: 'Missing signature' });
      }

      // Verify the HMAC over the *raw* request bytes (captured by the
      // express.json verify hook in src/app.js). Re-serialising req.body
      // would not match Razorpay's signature.
      if (!req.rawBody) {
        logger.error('Razorpay webhook raw body unavailable — cannot verify signature');
        return res.status(500).json({ error: 'Server misconfigured' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody)
        .digest('hex');

      // Constant-time comparison to avoid timing oracles.
      const sigBuf = Buffer.from(razorpaySignature, 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        logger.warn('Invalid Razorpay webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const event = req.body;
      logger.info(`Razorpay webhook received: ${event.event}`);

      // Handle different event types
      switch (event.event) {
        case 'payment.captured':
          await handlePaymentCaptured(event);
          break;
        case 'payment.failed':
          await handlePaymentFailed(event);
          break;
        case 'subscription.activated':
          await handleSubscriptionActivated(event);
          break;
        case 'subscription.charged':
          await handleSubscriptionCharged(event);
          break;
        case 'subscription.paused':
          await handleSubscriptionPaused(event);
          break;
        case 'subscription.resumed':
          await handleSubscriptionResumed(event);
          break;
        case 'subscription.cancelled':
          await handleSubscriptionCancelled(event);
          break;
        case 'subscription.completed':
          await handleSubscriptionCompleted(event);
          break;
        default:
          logger.info(`Unhandled Razorpay webhook event: ${event.event}`);
      }

      res.json({ success: true });
    } catch (err) {
      logger.error('Razorpay webhook error:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
};

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(event) {
  try {
    const payment = event.payload.payment.entity;
    const masterModels = require('../models/masterModels');

    // Check if payment already exists
    let paymentRecord = await masterModels.Payment.findOne({
      where: { razorpay_payment_id: payment.id },
    });

    if (!paymentRecord) {
      // Find tenant from payment notes
      const tenantId = payment.notes?.tenant_id;
      if (!tenantId) {
        logger.warn(`Payment ${payment.id} has no tenant_id in notes`);
        return;
      }

      // Find subscription if payment has subscription link
      let subscription = null;
      if (payment.subscription_id) {
        subscription = await masterModels.Subscription.findOne({
          where: { razorpay_subscription_id: payment.subscription_id },
        });
      }

      // Create payment record
      paymentRecord = await masterModels.Payment.create({
        tenant_id: tenantId,
        subscription_id: subscription?.id || null,
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id || null,
        razorpay_invoice_id: payment.invoice_id || null,
        amount: payment.amount / 100, // Convert from paise
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        description: payment.description,
        notes: payment.notes || {},
        metadata: payment,
        paid_at: payment.captured_at ? new Date(payment.captured_at * 1000) : new Date(),
      });
    } else {
      // Update existing payment
      await paymentRecord.update({
        status: payment.status,
        method: payment.method,
        paid_at: payment.captured_at ? new Date(payment.captured_at * 1000) : paymentRecord.paid_at,
        metadata: payment,
      });
    }

    // Update subscription status if this is a subscription payment
    if (payment.subscription_id) {
      const subscription = await masterModels.Subscription.findOne({
        where: { razorpay_subscription_id: payment.subscription_id },
      });

      if (subscription && subscription.status !== 'active') {
        await subscription.update({ status: 'active' });
        
        const tenant = await masterModels.TenantMaster.findByPk(subscription.tenant_id);
        if (tenant) {
          await tenant.update({
            subscription_plan: subscription.plan_code,
            subscription_start: subscription.start_date,
            subscription_end: subscription.end_date,
            razorpay_subscription_id: subscription.razorpay_subscription_id,
          });

            // Create referral reward if tenant used a referral code
            if (tenant.referral_code && subscription.plan_code) {
              try {
                const referralDiscountService = require('../services/referralDiscountService');
                const basePrice = parseFloat(subscription.amount || 0);
                await referralDiscountService.createReferralReward(
                  tenant.id,
                  subscription.plan_code,
                  basePrice
                );
              } catch (rewardError) {
                logger.error('Failed to create referral reward in payment.captured:', rewardError);
                // Don't fail payment processing if reward creation fails
              }
            }
          }
        }
      } else {
        // One-time payment - also create referral reward if applicable
        const tenant = await masterModels.TenantMaster.findByPk(paymentRecord.tenant_id);
        if (tenant && tenant.referral_code && payment.notes?.plan_code) {
          try {
            const referralDiscountService = require('../services/referralDiscountService');
            const basePrice = parseFloat(paymentRecord.amount || 0);
            await referralDiscountService.createReferralReward(
              tenant.id,
              payment.notes.plan_code,
              basePrice
            );
          } catch (rewardError) {
            logger.error('Failed to create referral reward for one-time payment:', rewardError);
            // Don't fail payment processing if reward creation fails
        }
      }
    }

    logger.info(`Payment captured: ${payment.id} for tenant ${paymentRecord.tenant_id}`);
  } catch (err) {
    logger.error('Error handling payment.captured:', err);
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(event) {
  try {
    const payment = event.payload.payment.entity;
    const masterModels = require('../models/masterModels');

    const paymentRecord = await masterModels.Payment.findOne({
      where: { razorpay_payment_id: payment.id },
    });

    if (paymentRecord) {
      await paymentRecord.update({
        status: 'failed',
        metadata: payment,
      });
    } else {
      // Create failed payment record
      const tenantId = payment.notes?.tenant_id;
      if (tenantId) {
        await masterModels.Payment.create({
          tenant_id: tenantId,
          razorpay_payment_id: payment.id,
          amount: payment.amount / 100,
          currency: payment.currency,
          status: 'failed',
          method: payment.method,
          metadata: payment,
        });
      }
    }

    logger.info(`Payment failed: ${payment.id}`);
  } catch (err) {
    logger.error('Error handling payment.failed:', err);
  }
}

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const masterModels = require('../models/masterModels');

    const subscriptionRecord = await masterModels.Subscription.findOne({
      where: { razorpay_subscription_id: subscription.id },
    });

    if (subscriptionRecord) {
      await subscriptionRecord.update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_start * 1000),
        current_period_end: new Date(subscription.current_end * 1000),
        metadata: subscription,
      });

      const tenant = await masterModels.TenantMaster.findByPk(subscriptionRecord.tenant_id);
      if (tenant) {
        await tenant.update({
          subscription_plan: subscriptionRecord.plan_code,
          subscription_start: subscriptionRecord.start_date,
          subscription_end: subscriptionRecord.end_date,
        });

        // Create referral reward if tenant used a referral code
        if (tenant.referral_code && subscriptionRecord.plan_code) {
          try {
            const referralDiscountService = require('../services/referralDiscountService');
            const basePrice = parseFloat(subscriptionRecord.amount || 0);
            await referralDiscountService.createReferralReward(
              tenant.id,
              subscriptionRecord.plan_code,
              basePrice
            );
          } catch (rewardError) {
            logger.error('Failed to create referral reward in subscription.activated:', rewardError);
            // Don't fail subscription activation if reward creation fails
          }
        }
      }
    }

    logger.info(`Subscription activated: ${subscription.id}`);
  } catch (err) {
    logger.error('Error handling subscription.activated:', err);
  }
}

/**
 * Handle subscription.charged event (recurring payment)
 */
async function handleSubscriptionCharged(event) {
  try {
    const payment = event.payload.payment.entity;
    const subscription = event.payload.subscription.entity;
    const masterModels = require('../models/masterModels');

    const subscriptionRecord = await masterModels.Subscription.findOne({
      where: { razorpay_subscription_id: subscription.id },
    });

    if (subscriptionRecord) {
      // Update subscription period
      await subscriptionRecord.update({
        current_period_start: new Date(subscription.current_start * 1000),
        current_period_end: new Date(subscription.current_end * 1000),
        metadata: subscription,
      });

      // Create or update payment record
      let paymentRecord = await masterModels.Payment.findOne({
        where: { razorpay_payment_id: payment.id },
      });

      if (!paymentRecord) {
        await masterModels.Payment.create({
          tenant_id: subscriptionRecord.tenant_id,
          subscription_id: subscriptionRecord.id,
          razorpay_payment_id: payment.id,
          razorpay_invoice_id: payment.invoice_id || null,
          amount: payment.amount / 100,
          currency: payment.currency,
          status: payment.status === 'captured' ? 'captured' : 'created',
          method: payment.method,
          metadata: payment,
          paid_at: payment.captured_at ? new Date(payment.captured_at * 1000) : new Date(),
        });
      }

      // Update tenant subscription dates
      const tenant = await masterModels.TenantMaster.findByPk(subscriptionRecord.tenant_id);
      if (tenant) {
        await tenant.update({
          subscription_end: subscriptionRecord.current_period_end,
        });
      }
    }

    logger.info(`Subscription charged: ${subscription.id}, payment: ${payment.id}`);
  } catch (err) {
    logger.error('Error handling subscription.charged:', err);
  }
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const masterModels = require('../models/masterModels');

    const subscriptionRecord = await masterModels.Subscription.findOne({
      where: { razorpay_subscription_id: subscription.id },
    });

    if (subscriptionRecord) {
      await subscriptionRecord.update({
        status: 'cancelled',
        cancelled_at: new Date(),
        metadata: subscription,
      });

      const tenant = await masterModels.TenantMaster.findByPk(subscriptionRecord.tenant_id);
      if (tenant) {
        await tenant.update({
          subscription_end: new Date(),
          razorpay_subscription_id: null,
        });
      }
    }

    logger.info(`Subscription cancelled: ${subscription.id}`);
  } catch (err) {
    logger.error('Error handling subscription.cancelled:', err);
  }
}

/**
 * Handle subscription.paused event
 */
async function handleSubscriptionPaused(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const masterModels = require('../models/masterModels');

    const subscriptionRecord = await masterModels.Subscription.findOne({
      where: { razorpay_subscription_id: subscription.id },
    });

    if (subscriptionRecord) {
      await subscriptionRecord.update({
        status: 'halted',
        metadata: subscription,
      });
    }

    logger.info(`Subscription paused: ${subscription.id}`);
  } catch (err) {
    logger.error('Error handling subscription.paused:', err);
  }
}

/**
 * Handle subscription.resumed event
 */
async function handleSubscriptionResumed(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const masterModels = require('../models/masterModels');

    const subscriptionRecord = await masterModels.Subscription.findOne({
      where: { razorpay_subscription_id: subscription.id },
    });

    if (subscriptionRecord) {
      await subscriptionRecord.update({
        status: 'active',
        metadata: subscription,
      });
    }

    logger.info(`Subscription resumed: ${subscription.id}`);
  } catch (err) {
    logger.error('Error handling subscription.resumed:', err);
  }
}

/**
 * Handle subscription.completed event
 */
async function handleSubscriptionCompleted(event) {
  try {
    const subscription = event.payload.subscription.entity;
    const masterModels = require('../models/masterModels');

    const subscriptionRecord = await masterModels.Subscription.findOne({
      where: { razorpay_subscription_id: subscription.id },
    });

    if (subscriptionRecord) {
      await subscriptionRecord.update({
        status: 'completed',
        end_date: new Date(subscription.ended_at * 1000),
        metadata: subscription,
      });

      const tenant = await masterModels.TenantMaster.findByPk(subscriptionRecord.tenant_id);
      if (tenant) {
        await tenant.update({
          subscription_end: new Date(subscription.ended_at * 1000),
          razorpay_subscription_id: null,
        });
      }
    }

    logger.info(`Subscription completed: ${subscription.id}`);
  } catch (err) {
    logger.error('Error handling subscription.completed:', err);
  }
}
