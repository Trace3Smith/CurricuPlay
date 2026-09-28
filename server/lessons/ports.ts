import type { LessonLibrary, LessonSaveInput, ReflectionInput, ScheduleLessonInput } from '../../shared/contracts/lessons';

export interface LessonRepository {
  read(): Promise<LessonLibrary>;
  save(id: string | null, input: LessonSaveInput): Promise<{ lessonId: string; versionId: string }>;
  schedule(input: ScheduleLessonInput): Promise<string>;
  markTaught(occurrenceId: string, taughtOn: string): Promise<string>;
  reflect(teachingRecordId: string, input: ReflectionInput): Promise<string>;
}
