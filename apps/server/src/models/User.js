import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { ALL_ROLES, ROLES } from '@aidflow/shared';
import { config } from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      enum: {
        values: ALL_ROLES,
        message: '{VALUE} is not a valid role'
      },
      default: ROLES.DONOR,
      required: true
    },
    phone: {
      type: String,
      trim: true
    },
    organization: {
      type: String,
      trim: true
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
        delete ret.passwordHash;
        delete ret.password;
        delete ret._plainPassword;
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Virtual for setting plain password if provided directly
userSchema.virtual('password')
  .set(function (password) {
    this._plainPassword = password;
  })
  .get(function () {
    return this._plainPassword;
  });

// Pre-save hook to hash password into passwordHash using bcrypt if plain password was set
userSchema.pre('save', async function (next) {
  if (this._plainPassword) {
    try {
      const saltRounds = config.bcrypt?.saltRounds || 10;
      const salt = await bcrypt.genSalt(saltRounds);
      this.passwordHash = await bcrypt.hash(this._plainPassword, salt);
      this._plainPassword = undefined;
      return next();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Compare candidate password against stored passwordHash using bcrypt
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash passwords directly
userSchema.statics.hashPassword = async function (plainPassword) {
  const saltRounds = config.bcrypt?.saltRounds || 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(plainPassword, salt);
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
