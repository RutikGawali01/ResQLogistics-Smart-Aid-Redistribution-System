import mongoose from 'mongoose';
import { VEHICLE_TYPES, RIDER_STATUS } from '@aidflow/shared';

const riderLocationSubSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heading: Number,
    speedKmh: Number,
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const riderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true
    },
    vehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
      required: true
    },
    maxCapacityKg: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: RIDER_STATUS,
      default: 'OFFLINE'
    },
    currentLocation: riderLocationSubSchema,
    activeAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null
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

riderSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });
riderSchema.index({ status: 1 });

export const Rider = mongoose.models.Rider || mongoose.model('Rider', riderSchema);
