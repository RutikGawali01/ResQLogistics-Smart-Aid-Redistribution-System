# AidFlow Worker Architecture (Zero-Redis Queue)

This document details the background processing architecture for **AidFlow**, which strictly adheres to the rule:

> **STRICT ARCHITECTURAL CONSTRAINT**: Do not use Redis, BullMQ, or Redis-based queues.

---

## 1. Architectural Strategy

Instead of relying on external Redis or BullMQ instances, the background worker uses an **ACID-reliable, MongoDB-backed persistent job queue** with atomic locks, plus a **zero-dependency in-memory simulation runner** for local developer decoupling.

### Benefits
1. **Zero External Infrastructure Overhead**: Developers only need Node.js and optional MongoDB. No separate Redis container or memory store.
2. **ACID Transactional Guarantees**: Job records share the same primary database as donations and assignments.
3. **Decoupled Fallback**: If MongoDB is not running locally, the worker automatically switches to in-memory mode, ensuring both developers can test background workflows out-of-the-box.

---

## 2. Atomic Lock & Polling Pattern

The worker claims jobs using MongoDB's atomic `findOneAndUpdate`:

```javascript
const job = await Job.findOneAndUpdate(
  {
    status: 'PENDING',
    executeAt: { $lte: new Date() },
    $or: [
      { lockedAt: null },
      { lockedAt: { $lt: new Date(Date.now() - lockTimeoutMs) } } // Stale lock recovery
    ]
  },
  {
    $set: {
      status: 'PROCESSING',
      lockedAt: new Date(),
      lockedBy: workerInstanceId
    },
    $inc: { attempts: 1 }
  },
  { new: true, sort: { executeAt: 1 } }
);
```

### Stale Lock Recovery
If a worker crashes while processing a job, the lock becomes stale once `Date.now() - lockedAt > lockTimeoutMs` (default: 60 seconds). Another worker instance automatically reclaims the abandoned job.

### Exponential Backoff & Retries
On handler exceptions:
1. `attempts` is incremented.
2. If `attempts < maxRetries`, status reverts to `PENDING` with an exponential delay:
   $$\text{delaySeconds} = 2^{\text{attempts}}$$
3. If `attempts >= maxRetries`, status transitions to `FAILED` and error stack is captured in `lastError`.

---

## 3. Background Job Handlers

| Job Type | Handler | Schedule / Trigger | Purpose |
|---|---|---|---|
| `EXPIRATION_CHECKER` | `expirationCheckerHandler` | Recurring (Every 60s) | Scans for donations approaching expiration deadline; alerts shelters or marks expired. |
| `DISPATCH_OPTIMIZER` | `dispatchOptimizerHandler` | Recurring (Every 60s) or Event-triggered | Computes route matches between unassigned donations, highest-urgency shelters, and available riders. |

---

## 4. Worker Lifecycle & Graceful Shutdown

1. **Boot**: `node src/index.js` checks MongoDB connection, registers job handlers, enqueues recurring maintenance tasks, and starts polling loop.
2. **Execution**: Polls at `WORKER_POLL_INTERVAL_MS` (default 3000ms), respecting `WORKER_CONCURRENCY` limit.
3. **Termination**: On `SIGINT` or `SIGTERM`, worker stops accepting new tasks, awaits completion of in-flight jobs, disconnects database cleanly, and exits.
