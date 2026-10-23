import mongoose from 'mongoose';
import { DONATION_CATEGORIES, STORAGE_REQUIREMENTS, DONATION_STATUS } from '@aidflow/shared';

const locationSubSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    city: String,
    postalCode: String,
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    contactName: String,
    contactPhone: String
  },
  { _id: false }
);

const donationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    category: {
      type: String,
      enum: DONATION_CATEGORIES,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.1
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    storageRequirement: {
      type: String,
      enum: STORAGE_REQUIREMENTS,
      default: 'ROOM_TEMPERATURE'
    },
    expirationDate: {
      type: Date,
      required: true
    },
    pickupLocation: {
      type: locationSubSchema,
      required: true
    },
    status: {
      type: String,
      enum: DONATION_STATUS,
      default: 'AVAILABLE'
    },
    allergens: [String],
    specialInstructions: String
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

donationSchema.index({ 'pickupLocation.latitude': 1, 'pickupLocation.longitude': 1 });
donationSchema.index({ status: 1, expirationDate: 1 });

export const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);
