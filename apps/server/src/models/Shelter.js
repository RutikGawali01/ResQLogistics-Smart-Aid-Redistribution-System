import mongoose from 'mongoose';
import { SHELTER_URGENCY, DONATION_CATEGORIES } from '@aidflow/shared';

const shelterCapacitySubSchema = new mongoose.Schema(
  {
    currentOccupancy: { type: Number, required: true, default: 0 },
    maxCapacity: { type: Number, required: true },
    mealsNeededPerDay: { type: Number, default: 0 }
  },
  { _id: false }
);

const shelterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    address: {
      type: String,
      required: true
    },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    capacity: {
      type: shelterCapacitySubSchema,
      required: true
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
      required: true
    },
    operatingHours: String,
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

shelterSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

export const Shelter = mongoose.models.Shelter || mongoose.model('Shelter', shelterSchema);
