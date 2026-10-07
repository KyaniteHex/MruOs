import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

// One calendar subscription per account.
const calendarFeedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // SHA-256 of the token in the link; the token itself is never stored.
    tokenHash: { type: String, required: true, unique: true },
    linkCreatedAt: { type: Date, required: true },
    options: {
      assessments: { type: Boolean, required: true },
      notes: { type: Boolean, required: true },
      daysOff: { type: Boolean, required: true },
      periods: { type: Boolean, required: true },
    },
  },
  { timestamps: true },
);

export type CalendarFeedRecord = InferSchemaType<typeof calendarFeedSchema>;

export const CalendarFeedModel =
  (mongoose.models.CalendarFeed as Model<CalendarFeedRecord> | undefined) ??
  mongoose.model<CalendarFeedRecord>('CalendarFeed', calendarFeedSchema);
