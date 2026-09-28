import { z } from 'zod';
import { idSchema, type TeachingAssignment } from './foundation';

/** Ordered, optional sections. Namespaced kinds allow future Role Packs without changing the core. */
export const lessonSectionGroups = [
  { label: 'Alignment', fields: [['objective', 'Learning target / objective'], ['success_criteria', 'Success criteria'], ['essential_question', 'Essential question']] },
  { label: 'Preparation', fields: [['vocabulary', 'Vocabulary'], ['materials', 'Materials / resources'], ['setup', 'Setup'], ['safety', 'Safety'], ['routines', 'Routines / procedures']] },
  { label: 'Instruction', fields: [['opening', 'Opening / warm-up'], ['explicit_instruction', 'Direct / explicit instruction'], ['practice', 'Student practice'], ['active_learning', 'Active learning'], ['understanding', 'Checks for understanding'], ['questions', 'Higher-order questions'], ['transitions', 'Transitions']] },
  { label: 'Learner support', fields: [['differentiation', 'Differentiation'], ['supports', 'Accommodations / supports'], ['remediation', 'Remediation'], ['extension', 'Enrichment / extension']] },
  { label: 'Assessment & closure', fields: [['formative_assessment', 'Formative assessment'], ['assessment_method', 'Assessment method'], ['closure', 'Closure / reflection'], ['evidence', 'Evidence expectations']] },
  { label: 'Teacher-only notes', fields: [['preparation_notes', 'Preparation notes'], ['private_notes', 'Private notes']] },
] as const;
export const sectionInput = z.object({
  kind: z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/), label: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(8000), audience: z.enum(['instruction', 'teacher']),
}).strict().refine(s => !['preparation_notes', 'private_notes'].includes(s.kind) || s.audience === 'teacher', 'Private notes must stay teacher-only.');
const ids = z.array(idSchema).max(100).refine(v => new Set(v).size === v.length, 'Choose each reference once.');
export const lessonSaveInput = z.object({
  title: z.string().trim().min(1).max(160), assignmentId: idSchema, readiness: z.enum(['draft', 'ready']),
  sections: z.array(sectionInput).max(60).refine(v => new Set(v.map(s => s.kind)).size === v.length, 'Use each section kind once.'),
  standardReferences: z.array(z.string().trim().min(1).max(300)).max(100),
  curriculumMode: z.enum(['active', 'retain']), curriculumVersionId: idSchema.nullable(), curriculumBindingId: idSchema.nullable(),
  curriculumNodeIds: z.array(z.string().min(1).max(80)).max(100).refine(v => new Set(v).size === v.length, 'Choose each curriculum node once.'),
  resourceVersionIds: ids, sourceVersionId: idSchema.nullable(), revision: z.number().int().positive().nullable(),
  acknowledgeLowRating: z.boolean(),
}).strict();
export const scheduleLessonInput = z.object({
  id: idSchema, versionId: idSchema, assignmentId: idSchema, scheduledOn: z.iso.date(), acknowledgeLowRating: z.boolean(),
}).strict();
export const taughtInput = z.object({ taughtOn: z.iso.date() }).strict();
export const reflectionInput = z.object({
  revision: z.number().int().positive().nullable(), rating: z.number().int().min(1).max(5),
  worked: z.string().trim().max(4000), change: z.string().trim().max(4000), reflection: z.string().trim().max(4000),
  pacing: z.string().trim().max(4000), materials: z.string().trim().max(4000), transitions: z.string().trim().max(4000),
}).strict();
export type LessonSaveInput = z.infer<typeof lessonSaveInput>;
export type ScheduleLessonInput = z.infer<typeof scheduleLessonInput>;
export type ReflectionInput = z.infer<typeof reflectionInput>;
export type LessonSection = z.infer<typeof sectionInput>;
export type AssignmentSnapshot = Pick<TeachingAssignment, 'title' | 'subject' | 'course' | 'grades' | 'teachingRole' | 'schoolYearId' | 'school' | 'schedule'>;
export interface Lesson { id: string; workspaceId: string; originalAssignmentId: string; copiedFromVersionId: string | null; revision: number; createdAt: string }
export interface LessonVersion extends Omit<LessonSaveInput, 'revision' | 'resourceVersionIds' | 'acknowledgeLowRating'> {
  id: string; lessonId: string; number: number; assignmentSnapshot: AssignmentSnapshot; curriculumAsOf: string;
  reuseWarningAcknowledged: boolean; createdAt: string;
}
export interface LessonResourceLink { lessonVersionId: string; resourceVersionId: string }
export interface LessonOccurrence { id: string; lessonVersionId: string; assignmentId: string; assignmentSnapshot: AssignmentSnapshot; scheduledOn: string; reuseWarningAcknowledged: boolean; createdAt: string }
export interface TeachingRecord { id: string; occurrenceId: string; taughtOn: string; createdAt: string }
export interface LessonReflection extends Omit<ReflectionInput, 'revision'> { id: string; teachingRecordId: string; revision: number; createdAt: string; updatedAt: string }
export interface LessonLibrary { lessons: Lesson[]; versions: LessonVersion[]; resourceLinks: LessonResourceLink[]; occurrences: LessonOccurrence[]; teachingRecords: TeachingRecord[]; reflections: LessonReflection[] }

export function teacherDate(timezone: string, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
/** Teaching memory belongs to this reusable identity; source lineage is provenance only. */
export function teachingMemory(library: LessonLibrary, lessonId: string) {
  return library.teachingRecords.flatMap(record => {
    const occurrence = library.occurrences.find(o => o.id === record.occurrenceId);
    const version = library.versions.find(v => v.id === occurrence?.lessonVersionId);
    if (!occurrence || !version || version.lessonId !== lessonId) return [];
    return [{ record, occurrence, version, reflection: library.reflections.find(r => r.teachingRecordId === record.id) }];
  }).sort((a, b) => b.record.taughtOn.localeCompare(a.record.taughtOn) || b.record.createdAt.localeCompare(a.record.createdAt));
}
export function hasLowRating(library: LessonLibrary, lessonId: string) {
  return teachingMemory(library, lessonId).some(m => m.reflection && m.reflection.rating <= 2);
}
