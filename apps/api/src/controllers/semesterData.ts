import { SemesterSchema } from '@mruos/shared';
import type { Semester } from '@mruos/shared';

const defaultSemester: Semester = { startDate: '2026-09-28', daysOff: [] };

type StoredSemester = {
  startDate: string;
  daysOff: string[];
  academicYear?: unknown;
};

/** The user's semester as stored, validated again before it is returned. */
export function semesterFromRecord(record: StoredSemester | null): Semester {
  if (!record) {
    return defaultSemester;
  }

  return SemesterSchema.parse({
    startDate: record.startDate,
    daysOff: record.daysOff,
    ...(record.academicYear ? { academicYear: record.academicYear } : {}),
  });
}

/** Update that replaces the stored semester, dropping a removed calendar. */
export function semesterUpdate(semester: Semester, userId: unknown) {
  const { academicYear, ...fields } = semester;

  return {
    $set: academicYear ? { ...fields, academicYear } : fields,
    ...(academicYear ? {} : { $unset: { academicYear: 1 } }),
    $setOnInsert: { userId },
  };
}
