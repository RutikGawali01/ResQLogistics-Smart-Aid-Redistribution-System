import mongoose from 'mongoose';
import { ALL_ROLES } from '@aidflow/shared';

const eventSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['DONATION', 'SHELTER', 'RIDER', 'ASSIGNMENT', 'RESERVATION', 'SYSTEM', 'USER'],
      required: true
    },
    entityId: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      required: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    actorRole: {
      type: String,
      enum: ALL_ROLES
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    // Payload alias for backwards compatibility
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    // Timestamp alias for backwards compatibility
    timestamp: {
      type: Date,
      default: Date.now
    }
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

// Pre-save synchronization
eventSchema.pre('validate', function (next) {
  if (this.metadata && (!this.payload || Object.keys(this.payload).length === 0)) {
    this.payload = this.metadata;
  } else if (this.payload && (!this.metadata || Object.keys(this.metadata).length === 0)) {
    this.metadata = this.payload;
  }

  if (this.createdAt && !this.timestamp) {
    this.timestamp = this.createdAt;
  } else if (this.timestamp && !this.createdAt) {
    this.createdAt = this.timestamp;
  }

  next();
});

// Helper static method for convenient event recording
eventSchema.statics.logEvent = async function ({
  entityType,
  entityId,
  eventType,
  actorId = null,
  actorRole = null,
  metadata = {}
}) {
  try {
    return await this.create({
      entityType,
      entityId: String(entityId),
      eventType,
      actorId,
      actorRole,
      metadata,
      payload: metadata,
      createdAt: new Date(),
      timestamp: new Date()
    });
  } catch (err) {
    console.warn(`[EventLog Error] Failed to log event ${eventType}:`, err.message);
    return null;
  }
};

// Query indexes
eventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
eventSchema.index({ eventType: 1, createdAt: -1 });
eventSchema.index({ createdAt: -1 });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
