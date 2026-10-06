import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

// Kolokwia, exams and notes; validated with EntrySchema from @mruos/shared.
const entrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientId: { type: String, required: true },
    entry: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

entrySchema.index({ userId: 1, clientId: 1 }, { unique: true });

export type EntryRecord = InferSchemaType<typeof entrySchema>;

export const EntryModel =
  (mongoose.models.Entry as Model<EntryRecord> | undefined) ??
  mongoose.model<EntryRecord>('Entry', entrySchema);
