import mongoose from 'mongoose';
import { VEHICLE_TYPES, RIDER_STATUS } from '@aidflow/shared';

const riderLocationSubSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: String,
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
      trim: true
    },
    phone: {
      type: String
    },
    vehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
      default: 'E_BIKE'
    },
    capacity: {
      type: Number,
      required: true,
      min: [0.1, 'Capacity must be greater than zero']
    },
    // maxCapacityKg retained for backwards compatibility
    maxCapacityKg: {
      type: Number
    },
    availableCapacity: {
      type: Number,
      required: true,
      min: [0, 'Available capacity cannot be negative']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: RIDER_STATUS,
      default: 'AVAILABLE'
    },
    currentLocation: {
      type: riderLocationSubSchema,
      default: () => ({ latitude: 37.7749, longitude: -122.4194, updatedAt: new Date() })
    },
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

// Pre-save synchronization
riderSchema.pre('validate', function (next) {
  // Sync capacity and maxCapacityKg
  if (!this.capacity && this.maxCapacityKg) this.capacity = this.maxCapacityKg;
  if (!this.maxCapacityKg && this.capacity) this.maxCapacityKg = this.capacity;

  if (this.availableCapacity === undefined || this.availableCapacity === null) {
    this.availableCapacity = this.capacity;
  }

  // Validate and auto-clamp availableCapacity <= capacity
  if (this.availableCapacity > this.capacity) {
    this.availableCapacity = this.capacity;
  }

  // Sync isAvailable with status
  if (this.isModified('isAvailable') && !this.isModified('status')) {
    this.status = this.isAvailable ? 'AVAILABLE' : 'OFFLINE';
  } else if (this.isModified('status') && !this.isModified('isAvailable')) {
    this.isAvailable = this.status === 'AVAILABLE';
  }

  next();
});

// Query indexes
riderSchema.index({ isAvailable: 1, availableCapacity: -1 });
riderSchema.index({ status: 1 });
riderSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });

export const Rider = mongoose.models.Rider || mongoose.model('Rider', riderSchema);
