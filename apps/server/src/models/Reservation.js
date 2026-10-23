import mongoose from 'mongoose';
import { RESERVATION_STATUS } from '@aidflow/shared';

const reservationSchema = new mongoose.Schema(
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
    reservedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: RESERVATION_STATUS,
      default: 'REQUESTED'
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 0.1
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

reservationSchema.index({ donationId: 1, shelterId: 1 });
reservationSchema.index({ status: 1, expiresAt: 1 });

export const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
