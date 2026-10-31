import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatarId?: string;
  dob?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  stats: {
    games: number;
    wins: number;
    tags: number;
    escapes: number;
    kmRun: number;
  };
  fcmToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatarId: {
      type: String,
      default: 'wolf',
    },
    dob: {
      type: String,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    stats: {
      games: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      tags: { type: Number, default: 0 },
      escapes: { type: Number, default: 0 },
      kmRun: { type: Number, default: 0 },
    },
    fcmToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
