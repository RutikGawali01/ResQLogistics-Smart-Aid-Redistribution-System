import mongoose from 'mongoose';

/**
 * MongoDB-backed persistent job queue model.
 * Adheres strictly to the architectural constraint: NO REDIS / NO BULLMQ.
 */
const jobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    executeAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lockedAt: {
      type: Date,
      default: null
    },
    lockedBy: {
      type: String,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    lastError: {
      message: String,
      stack: String,
      failedAt: Date
    },
    completedAt: Date
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

jobSchema.index({ status: 1, executeAt: 1, lockedAt: 1 });

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
