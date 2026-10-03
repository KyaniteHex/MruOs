import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type UserRecord = InferSchemaType<typeof userSchema>;

export const UserModel =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>('User', userSchema);
