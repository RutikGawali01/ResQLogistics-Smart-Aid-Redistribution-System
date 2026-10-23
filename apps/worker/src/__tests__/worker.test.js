import { describe, it, expect, vi } from 'vitest';
import { JobQueue } from '../queue/JobQueue.js';

describe('AidFlow Worker - Zero-Redis JobQueue', () => {
  it('registers handlers and executes enqueued jobs', async () => {
    const queue = new JobQueue({
      workerId: 'test-worker-01',
      pollIntervalMs: 50,
      maxRetries: 2
    });

    const mockHandler = vi.fn().mockResolvedValue({ processed: true });
    queue.registerHandler('TEST_JOB', mockHandler);

    await queue.enqueue('TEST_JOB', { testData: 123 });

    // Claim and execute directly
    const claimedJob = await queue.claimNextJob();
    expect(claimedJob).not.toBeNull();
    expect(claimedJob.status).toBe('PROCESSING');
    expect(claimedJob.type).toBe('TEST_JOB');

    await queue.processJob(claimedJob);

    expect(mockHandler).toHaveBeenCalledWith({ testData: 123 });
    expect(claimedJob.status).toBe('COMPLETED');
    expect(claimedJob.completedAt).toBeDefined();
  });

  it('retries failing jobs up to maxRetries with backoff', async () => {
    const queue = new JobQueue({
      workerId: 'test-worker-02',
      pollIntervalMs: 50,
      maxRetries: 2
    });

    const failingHandler = vi.fn().mockRejectedValue(new Error('Transient dispatch failure'));
    queue.registerHandler('FAILING_JOB', failingHandler);

    await queue.enqueue('FAILING_JOB', { attempt: 1 });

    // First attempt: should fail and reschedule as PENDING
    const job1 = await queue.claimNextJob();
    expect(job1.attempts).toBe(1);
    await queue.processJob(job1);
    expect(job1.status).toBe('PENDING');
    expect(job1.lastError.message).toBe('Transient dispatch failure');

    // Manually reset executeAt to now for immediate second claim
    job1.executeAt = new Date(Date.now() - 1000);

    // Second attempt: should hit maxRetries and mark FAILED
    const job2 = await queue.claimNextJob();
    expect(job2.attempts).toBe(2);
    await queue.processJob(job2);
    expect(job2.status).toBe('FAILED');
  });
});
