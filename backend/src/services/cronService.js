/**
 * Cron Service
 * 
 * Manages scheduled tasks within the application
 */

const cron = require('node-cron');
const os = require('os');
const logger = require('../utils/logger');
const redisClient = require('../config/redis');
const TrialCleanupService = require('../../scripts/cleanup-expired-trials');

const INSTANCE_ID = `${os.hostname()}-${process.pid}`;

/**
 * Run `task` only if this process wins a Redis lock for `lockKey`.
 *
 * Without this, every backend replica would fire the same cron tick
 * and run the job N times. We use SET NX EX to acquire the lock and
 * release it on the way out (best-effort). Lock TTL is sized to be
 * larger than the slowest expected job run so a crashed worker can't
 * deadlock the schedule.
 *
 * If Redis is unreachable we **fail open** (run the job) — better to
 * occasionally double-run than to silently skip nightly cleanup
 * because Redis blipped.
 */
async function runWithLeaderLock(lockKey, ttlSeconds, task) {
  if (!redisClient.isConnected || !redisClient.isConnected()) {
    logger.warn(`[cron] Redis unavailable; running ${lockKey} without lock`);
    return task();
  }
  const fullKey = `cron:lock:${lockKey}`;
  let acquired = false;
  try {
    const reply = await redisClient.sendCommand([
      'SET', fullKey, INSTANCE_ID, 'NX', 'EX', String(ttlSeconds),
    ]);
    acquired = reply === 'OK';
  } catch (err) {
    logger.warn(`[cron] Lock acquisition failed for ${lockKey}: ${err.message}; running anyway`);
    return task();
  }

  if (!acquired) {
    logger.info(`[cron] Skipping ${lockKey} — another instance holds the lock`);
    return;
  }

  try {
    await task();
  } finally {
    // Best-effort release. We compare-and-delete so a job that ran
    // longer than its TTL doesn't accidentally release another worker's
    // lock.
    try {
      const luaCAD = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;
      await redisClient.sendCommand(['EVAL', luaCAD, '1', fullKey, INSTANCE_ID]);
    } catch (e) {
      logger.warn(`[cron] Lock release failed for ${lockKey}: ${e.message}`);
    }
  }
}

class CronService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize all cron jobs
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('CronService already initialized');
      return;
    }

    try {
      logger.info('🕒 Initializing Cron Service...');

      // Setup trial cleanup job - runs daily at 2:00 AM
      this.setupTrialCleanupJob();

      // Setup other scheduled jobs here
      // this.setupOtherJob();

      this.isInitialized = true;
      logger.info('✅ Cron Service initialized successfully');
      
      // Log active jobs
      const activeJobs = Array.from(this.jobs.keys());
      if (activeJobs.length > 0) {
        logger.info(`📋 Active cron jobs: ${activeJobs.join(', ')}`);
      }

    } catch (error) {
      logger.error('❌ Failed to initialize Cron Service:', error);
      throw error;
    }
  }

  /**
   * Setup trial cleanup job
   */
  setupTrialCleanupJob() {
    const jobName = 'trial-cleanup';
    
    // Run daily at 2:00 AM
    // Cron format: second minute hour day month dayOfWeek
    const schedule = '0 2 * * *'; // Every day at 2:00 AM
    
    const job = cron.schedule(schedule, async () => {
      // Leader-elect via Redis so only one replica runs the job per tick.
      // 1-hour TTL: comfortably longer than the cleanup ever takes.
      await runWithLeaderLock(jobName, 3600, async () => {
        logger.info('🧹 Starting scheduled trial cleanup...');
        try {
          const cleanup = new TrialCleanupService();
          await cleanup.run();
          logger.info('✅ Scheduled trial cleanup completed successfully');
        } catch (error) {
          logger.error('❌ Scheduled trial cleanup failed:', error);
        }
      });
    }, {
      scheduled: false, // Don't start immediately
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set(jobName, job);
    
    // Start the job
    job.start();
    
    logger.info(`📅 Trial cleanup job scheduled: ${schedule} (${process.env.TIMEZONE || 'UTC'})`);
    
    // Log next execution time
    const nextExecution = this.getNextExecutionTime(schedule);
    if (nextExecution) {
      logger.info(`⏰ Next trial cleanup: ${nextExecution.toISOString()}`);
    }
  }

  /**
   * Setup other scheduled jobs (example)
   */
  setupOtherJob() {
    // Example: Database backup job
    const jobName = 'database-backup';
    const schedule = '0 1 * * 0'; // Every Sunday at 1:00 AM
    
    const job = cron.schedule(schedule, async () => {
      await runWithLeaderLock(jobName, 3600, async () => {
        logger.info('💾 Starting scheduled database backup...');
        try {
          // Add your backup logic here
          logger.info('✅ Scheduled database backup completed');
        } catch (error) {
          logger.error('❌ Scheduled database backup failed:', error);
        }
      });
    }, {
      scheduled: false,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set(jobName, job);
    job.start();
    
    logger.info(`📅 Database backup job scheduled: ${schedule}`);
  }

  /**
   * Get next execution time for a cron schedule
   */
  getNextExecutionTime(schedule) {
    try {
      // Simple calculation for daily 2:00 AM job
      const now = new Date();
      const next = new Date();
      next.setHours(2, 0, 0, 0);
      
      // If 2:00 AM today has passed, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      return next;
    } catch (error) {
      return null;
    }
  }

  /**
   * Stop a specific job
   */
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`⏹️  Stopped cron job: ${jobName}`);
    }
  }

  /**
   * Start a specific job
   */
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`▶️  Started cron job: ${jobName}`);
    }
  }

  /**
   * Stop all jobs
   */
  stopAll() {
    for (const [jobName, job] of this.jobs) {
      job.stop();
      logger.info(`⏹️  Stopped cron job: ${jobName}`);
    }
    logger.info('⏹️  All cron jobs stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const status = {};
    for (const [jobName, job] of this.jobs) {
      status[jobName] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    }
    return status;
  }

  /**
   * Manually trigger trial cleanup (for testing)
   */
  async triggerTrialCleanup(dryRun = true) {
    logger.info(`🧪 Manually triggering trial cleanup (dry run: ${dryRun})...`);
    
    try {
      // Temporarily set dry run mode
      const originalDryRun = process.env.CLEANUP_DRY_RUN;
      process.env.CLEANUP_DRY_RUN = dryRun.toString();
      
      const cleanup = new TrialCleanupService();
      await cleanup.run();
      
      // Restore original setting
      if (originalDryRun !== undefined) {
        process.env.CLEANUP_DRY_RUN = originalDryRun;
      } else {
        delete process.env.CLEANUP_DRY_RUN;
      }
      
      logger.info('✅ Manual trial cleanup completed');
      return { success: true, message: 'Trial cleanup completed successfully' };
    } catch (error) {
      logger.error('❌ Manual trial cleanup failed:', error);
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance
const cronService = new CronService();
module.exports = cronService;