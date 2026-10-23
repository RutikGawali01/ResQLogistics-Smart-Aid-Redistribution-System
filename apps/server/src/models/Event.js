import mongoose from 'mongoose';
import { ALL_ROLES } from '@aidflow/shared';

const eventSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['DONATION', 'SHELTER', 'RIDER', 'ASSIGNMENT', 'RESERVATION', 'SYSTEM'],
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
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
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

eventSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
eventSchema.index({ eventType: 1, timestamp: -1 });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
