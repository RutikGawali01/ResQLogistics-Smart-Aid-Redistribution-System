import mongoose from 'mongoose';
import {
  ALL_ASSIGNMENT_STATUSES,
  ASSIGNMENT_STATUS,
  canTransitionAssignment
} from '@aidflow/shared';

const locationSubSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    city: String,
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    contactName: String,
    contactPhone: String
  },
  { _id: false }
);

const timelineSubSchema = new mongoose.Schema(
  {
    assignedAt: Date,
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    cancelledAt: Date
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true
    },
    shelterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      required: true
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      default: null
    },
    status: {
      type: String,
      enum: ALL_ASSIGNMENT_STATUSES,
      default: ASSIGNMENT_STATUS.UNASSIGNED,
      required: true
    },
    pickupLocation: {
      type: locationSubSchema,
      required: true
    },
    deliveryLocation: {
      type: locationSubSchema,
      required: true
    },
    timeline: {
      type: timelineSubSchema,
      default: () => ({})
    },
    notes: String,
    cancellationReason: String
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

// Pre-save validation ensuring valid state machine transitions
assignmentSchema.pre('save', function (next) {
  if (this.isModified('status') && !this.isNew) {
    // When modified in an existing document
    const previousStatus = this._originalStatus || this._previousStatus;
    if (previousStatus && previousStatus !== this.status) {
      const validation = canTransitionAssignment(previousStatus, this.status);
      if (!validation.valid) {
        return next(new Error(`[StateTransitionError] ${validation.reason}`));
      }
    }
  }
  next();
});

// Cache original status upon document initialization
assignmentSchema.post('init', function () {
  this._originalStatus = this.status;
});

assignmentSchema.index({ status: 1, riderId: 1 });
assignmentSchema.index({ donationId: 1, shelterId: 1 });

export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
