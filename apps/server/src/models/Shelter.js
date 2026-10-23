import mongoose from 'mongoose';
import { SHELTER_URGENCY, DONATION_CATEGORIES } from '@aidflow/shared';

const locationSubSchema = new mongoose.Schema(
  {
    address: { type: String, default: 'AidFlow Relief Hub' },
    city: String,
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    contactName: String,
    contactPhone: String
  },
  { _id: false }
);

const shelterCapacitySubSchema = new mongoose.Schema(
  {
    currentOccupancy: { type: Number, default: 0, min: 0 },
    maxCapacity: { type: Number, default: 100, min: 0 },
    mealsNeededPerDay: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const shelterSchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: locationSubSchema,
      required: true
    },
    address: {
      type: String
    },
    currentDemand: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'currentDemand cannot be negative']
    },
    receivingCapacity: {
      type: Number,
      required: true,
      default: 100,
      min: [0, 'receivingCapacity cannot be negative']
    },
    availableResources: {
      type: [String],
      default: ['DRY_STORAGE', 'REFRIGERATION']
    },
    isOpen: {
      type: Boolean,
      default: true
    },
    // Retained for backwards compatibility with existing UI
    capacity: {
      type: shelterCapacitySubSchema,
      default: () => ({ currentOccupancy: 0, maxCapacity: 100, mealsNeededPerDay: 0 })
    },
    urgencyLevel: {
      type: String,
      enum: SHELTER_URGENCY,
      default: 'MEDIUM'
    },
    acceptedCategories: [
      {
        type: String,
        enum: DONATION_CATEGORIES
      }
    ],
    contactPhone: {
      type: String,
      default: '+1-555-0100'
    },
    operatingHours: {
      type: String,
      default: '24/7'
    },
    active: {
      type: Boolean,
      default: true
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
shelterSchema.pre('validate', function (next) {
  // Sync address with location.address
  if (this.address && this.location && !this.location.address) {
    this.location.address = this.address;
  }
  if (this.location?.address && !this.address) {
    this.address = this.location.address;
  }

  // Sync capacity and demand fields
  if (this.capacity) {
    if (this.currentDemand === undefined || this.currentDemand === 0) {
      this.currentDemand = this.capacity.mealsNeededPerDay || 0;
    }
    if (this.receivingCapacity === undefined || this.receivingCapacity === 100) {
      this.receivingCapacity = this.capacity.maxCapacity || 100;
    }
  }

  // Sync isOpen with active
  if (this.isOpen !== undefined) {
    this.active = this.isOpen;
  }

  next();
});

// Query indexes
shelterSchema.index({ managerId: 1 });
shelterSchema.index({ isOpen: 1, currentDemand: -1 });
shelterSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
shelterSchema.index({ urgencyLevel: 1 });

export const Shelter = mongoose.models.Shelter || mongoose.model('Shelter', shelterSchema);
