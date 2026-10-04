import mongoose from 'mongoose';
import type { InferSchemaType, Model } from 'mongoose';

const semesterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    startDate: { type: String, required: true },
    daysOff: { type: [String], required: true, default: [] },
    // Validated by AcademicYearSchema from @mruos/shared on every write.
    academicYear: { type: mongoose.Schema.Types.Mixed, required: false },
  },
  { timestamps: true },
);

export type SemesterRecord = InferSchemaType<typeof semesterSchema>;

export const SemesterModel =
  (mongoose.models.Semester as Model<SemesterRecord> | undefined) ??
  mongoose.model<SemesterRecord>('Semester', semesterSchema);
