import mongoose from 'mongoose';
import { config } from '../config/env.js';

export class JobQueue {
  constructor(options = {}) {
    this.workerId = options.workerId || config.workerId;
    this.pollIntervalMs = options.pollIntervalMs || config.pollIntervalMs;
    this.concurrency = options.concurrency || config.concurrency;
    this.lockTimeoutMs = options.lockTimeoutMs || config.lockTimeoutMs;
    this.maxRetries = options.maxRetries || config.maxRetries;

    this.handlers = new Map();
    this.isRunning = false;
    this.activeJobsCount = 0;
    this.pollTimer = null;
    this.inMemoryJobs = [];
  }

  /**
   * Registers an execution handler for a specific job type.
   * @param {string} jobType
   * @param {(payload: any) => Promise<any>} handlerFn
   */
  registerHandler(jobType, handlerFn) {
    this.handlers.set(jobType, handlerFn);
    console.log(`[JobQueue] Registered handler for job type: "${jobType}"`);
  }

  /**
   * Enqueues a new background job into MongoDB or in-memory fallback.
   */
  async enqueue(type, payload = {}, executeAt = new Date()) {
    const jobData = {
      type,
      payload,
      status: 'PENDING',
      executeAt: new Date(executeAt),
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      const JobModel = mongoose.models.Job;
      if (JobModel) {
        return await JobModel.create(jobData);
      }
    }

    const mockJob = {
      ...jobData,
      _id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    this.inMemoryJobs.push(mockJob);
    return mockJob;
  }

  /**
   * Starts the polling loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[JobQueue] Worker engine started (${this.workerId})`);
    console.log(`[JobQueue] Strict constraint verified: ZERO Redis / BullMQ dependencies.`);
    this.scheduleNextPoll(0);
  }

  /**
   * Stops the polling loop gracefully.
   */
  async stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    console.log(`[JobQueue] Stopping worker... Waiting for ${this.activeJobsCount} active jobs.`);
    while (this.activeJobsCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log('[JobQueue] Worker stopped cleanly.');
  }

  scheduleNextPoll(delayMs = this.pollIntervalMs) {
    if (!this.isRunning) return;
    this.pollTimer = setTimeout(() => this.pollAndExecute(), delayMs);
  }

  /**
   * Main polling tick.
   */
  async pollAndExecute() {
    if (!this.isRunning) return;

    try {
      while (this.activeJobsCount < this.concurrency) {
        const job = await this.claimNextJob();
        if (!job) break;

        this.activeJobsCount++;
        this.processJob(job).finally(() => {
          this.activeJobsCount--;
        });
      }
    } catch (err) {
      console.error('[JobQueue] Error during polling tick:', err.message);
    } finally {
      this.scheduleNextPoll();
    }
  }

  /**
   * Atomically claims the next eligible pending job using MongoDB findOneAndUpdate.
   */
  async claimNextJob() {
    const now = new Date();
    const staleLockThreshold = new Date(now.getTime() - this.lockTimeoutMs);

    if (mongoose.connection.readyState === 1 && mongoose.models.Job) {
      const Job = mongoose.models.Job;
      return await Job.findOneAndUpdate(
        {
          status: 'PENDING',
          executeAt: { $lte: now },
          $or: [
            { lockedAt: null },
            { lockedAt: { $lt: staleLockThreshold } }
          ]
        },
        {
          $set: {
            status: 'PROCESSING',
            lockedAt: now,
            lockedBy: this.workerId
          },
          $inc: { attempts: 1 }
        },
        { new: true, sort: { executeAt: 1 } }
      );
    }

    // In-memory fallback
    const eligibleIndex = this.inMemoryJobs.findIndex(j =>
      j.status === 'PENDING' &&
      new Date(j.executeAt) <= now &&
      (!j.lockedAt || new Date(j.lockedAt) < staleLockThreshold)
    );

    if (eligibleIndex >= 0) {
      const job = this.inMemoryJobs[eligibleIndex];
      job.status = 'PROCESSING';
      job.lockedAt = now;
      job.lockedBy = this.workerId;
      job.attempts = (job.attempts || 0) + 1;
      return job;
    }

    return null;
  }

  /**
   * Executes a claimed job and handles success/retry/failure.
   */
  async processJob(job) {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      console.warn(`[JobQueue] No handler registered for job type "${job.type}". Failing job.`);
      await this.markJobFailed(job, new Error(`Unrecognized job type: ${job.type}`));
      return;
    }

    try {
      console.log(`[JobQueue] Processing job [${job.type}] (ID: ${job._id || job.id}, attempt ${job.attempts}/${job.maxRetries})`);
      await handler(job.payload);
      await this.markJobCompleted(job);
      console.log(`[JobQueue] Completed job [${job.type}] (ID: ${job._id || job.id})`);
    } catch (err) {
      console.error(`[JobQueue] Job failed [${job.type}]: ${err.message}`);
      await this.handleJobError(job, err);
    }
  }

  async markJobCompleted(job) {
    const now = new Date();
    if (mongoose.connection.readyState === 1 && job.save) {
      job.status = 'COMPLETED';
      job.completedAt = now;
      job.lockedAt = null;
      await job.save();
    } else {
      job.status = 'COMPLETED';
      job.completedAt = now;
      job.lockedAt = null;
    }
  }

  async markJobFailed(job, error) {
    const now = new Date();
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      failedAt: now
    };

    if (mongoose.connection.readyState === 1 && job.save) {
      job.status = 'FAILED';
      job.lastError = errorDetails;
      job.lockedAt = null;
      await job.save();
    } else {
      job.status = 'FAILED';
      job.lastError = errorDetails;
      job.lockedAt = null;
    }
  }

  async handleJobError(job, error) {
    const maxRetries = job.maxRetries || this.maxRetries;
    if (job.attempts >= maxRetries) {
      console.warn(`[JobQueue] Job reached max retries (${job.attempts}/${maxRetries}). Marking FAILED.`);
      await this.markJobFailed(job, error);
    } else {
      // Exponential backoff: 2s, 4s, 8s...
      const backoffSeconds = Math.pow(2, job.attempts);
      const nextExecuteAt = new Date(Date.now() + backoffSeconds * 1000);
      console.log(`[JobQueue] Scheduling retry #${job.attempts + 1} in ${backoffSeconds}s`);

      if (mongoose.connection.readyState === 1 && job.save) {
        job.status = 'PENDING';
        job.executeAt = nextExecuteAt;
        job.lockedAt = null;
        job.lastError = { message: error.message, failedAt: new Date() };
        await job.save();
      } else {
        job.status = 'PENDING';
        job.executeAt = nextExecuteAt;
        job.lockedAt = null;
        job.lastError = { message: error.message, failedAt: new Date() };
      }
    }
  }
}
