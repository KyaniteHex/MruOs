import type { AssessmentKind, ClassType } from './types.js';

// Polish names shown in the app and written into calendar files.

export const classTypeLabels: Record<ClassType, string> = {
  wyklad: 'Wykład',
  cwiczenia: 'Ćwiczenia',
  laboratorium: 'Laboratorium',
  seminarium: 'Seminarium',
  'zajecia-praktyczne': 'Zajęcia praktyczne',
};

export const assessmentKindLabels: Record<AssessmentKind, string> = {
  test: 'Kolokwium',
  exam: 'Egzamin',
};

/** Marks kolokwia and exams; exams stand out more. */
export const assessmentKindMarks: Record<AssessmentKind, string> = {
  test: '⚑',
  exam: '★',
};

export const noteMark = '✎';
