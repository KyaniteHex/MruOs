import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientId: { type: String, required: true },
    event: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

eventSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export type EventRecord = InferSchemaType<typeof eventSchema>;

export const EventModel =
  (mongoose.models.Event as Model<EventRecord> | undefined) ??
  mongoose.model<EventRecord>('Event', eventSchema);
