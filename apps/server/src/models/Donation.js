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
      trim: true
    },
    description: String,
    aidType: {
      type: String,
      enum: DONATION_CATEGORIES,
      required: true
    },
    // Category retained for backwards compatibility
    category: {
      type: String,
      enum: DONATION_CATEGORIES
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.1, 'Quantity must be greater than zero']
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: [0, 'Available quantity cannot be negative']
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    handlingRequirements: {
      type: String,
      default: 'ROOM_TEMPERATURE'
    },
    // StorageRequirement retained for backwards compatibility
    storageRequirement: {
      type: String,
      enum: STORAGE_REQUIREMENTS,
      default: 'ROOM_TEMPERATURE'
    },
    safeUseDeadline: {
      type: Date,
      required: true
    },
    // ExpirationDate retained for backwards compatibility
    expirationDate: {
      type: Date
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

// Pre-save hook: sync aliases and validate quantities
donationSchema.pre('validate', function (next) {
  // Sync aidType / category
  if (!this.aidType && this.category) this.aidType = this.category;
  if (!this.category && this.aidType) this.category = this.aidType;

  // Sync safeUseDeadline / expirationDate
  if (!this.safeUseDeadline && this.expirationDate) this.safeUseDeadline = this.expirationDate;
  if (!this.expirationDate && this.safeUseDeadline) this.expirationDate = this.safeUseDeadline;

  // Sync handlingRequirements / storageRequirement
  if (!this.handlingRequirements && this.storageRequirement) this.handlingRequirements = this.storageRequirement;
  if (!this.storageRequirement && this.handlingRequirements) this.storageRequirement = this.handlingRequirements;

  // Set default title if missing
  if (!this.title && this.aidType) {
    this.title = `${this.aidType.replace(/_/g, ' ')} Aid (${this.quantity} ${this.unit})`;
  }

  // Initialize availableQuantity if undefined
  if (this.availableQuantity === undefined || this.availableQuantity === null) {
    this.availableQuantity = this.quantity;
  }

  // Validate availableQuantity <= quantity
  if (this.availableQuantity > this.quantity) {
    return next(new Error('availableQuantity cannot exceed total quantity'));
  }

  next();
});

// Indexes for fast querying
donationSchema.index({ status: 1, safeUseDeadline: 1 });
donationSchema.index({ donorId: 1, createdAt: -1 });
donationSchema.index({ aidType: 1 });
donationSchema.index({ availableQuantity: 1 });
donationSchema.index({ 'pickupLocation.latitude': 1, 'pickupLocation.longitude': 1 });

export const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);
