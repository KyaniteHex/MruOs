import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

// Failed logins per e-mail. The address is stored only as a SHA-256 hash,
// and documents disappear on their own once the window or lock has passed.
const loginThrottleSchema = new mongoose.Schema({
  emailHash: { type: String, required: true, unique: true },
  failures: { type: Number, required: true, default: 0 },
  windowStartedAt: { type: Date, required: true },
  lockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
});

loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginThrottleRecord = InferSchemaType<typeof loginThrottleSchema>;

export const LoginThrottleModel =
  (mongoose.models.LoginThrottle as Model<LoginThrottleRecord> | undefined) ??
  mongoose.model<LoginThrottleRecord>('LoginThrottle', loginThrottleSchema);
