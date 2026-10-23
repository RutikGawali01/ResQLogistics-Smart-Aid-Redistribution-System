import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ALL_ROLES, ROLES } from '@aidflow/shared';
import { config } from '../config/env.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.DONOR,
      required: true
    },
    phone: {
      type: String,
      required: true,
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
        delete ret.password;
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(config.bcrypt.saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
