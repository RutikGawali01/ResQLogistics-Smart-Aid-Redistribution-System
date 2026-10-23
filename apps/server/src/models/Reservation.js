import mongoose from 'mongoose';
import { RESERVATION_STATUS } from '@aidflow/shared';

const reservationSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null
    },
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
    reservedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.1, 'Quantity must be greater than zero']
    },
    // requestedQuantity alias for backwards compatibility
    requestedQuantity: {
      type: Number
    },
    status: {
      type: String,
      enum: RESERVATION_STATUS,
      default: 'REQUESTED'
    },
    expiresAt: {
      type: Date,
      required: true
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
reservationSchema.pre('validate', function (next) {
  if (!this.quantity && this.requestedQuantity) this.quantity = this.requestedQuantity;
  if (!this.requestedQuantity && this.quantity) this.requestedQuantity = this.quantity;
  next();
});

// Query indexes
reservationSchema.index({ assignmentId: 1 });
reservationSchema.index({ donationId: 1, shelterId: 1 });
reservationSchema.index({ status: 1, expiresAt: 1 });

export const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
