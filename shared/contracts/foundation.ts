import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.iso.date();
export const idSchema = z.uuid();
export const profileInput = z.object({
  displayName: text(100),
  timezone: text(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Choose a valid timezone.'),
  revision: z.number().int().positive(),
}).strict();
export const yearInput = z.object({ name: text(80), startsOn: date, endsOn: date }).strict()
  .refine(value => value.endsOn >= value.startsOn, 'The end date must follow the start date.');
export const assignmentInput = z.object({
  schoolYearId: idSchema, title: text(120), jurisdiction: text(100),
  district: z.string().trim().max(150), school: z.string().trim().max(150),
  subject: text(100), course: z.string().trim().max(150),
  grades: z.array(text(30)).min(1).max(20).refine(values => new Set(values).size === values.length, 'Grades must be unique.'),
  teachingRole: text(100), schedule: z.string().trim().max(2000),
  startsOn: date, endsOn: date, isActive: z.boolean(),
}).strict().refine(value => value.endsOn >= value.startsOn, 'The end date must follow the start date.');
export const contextInput = z.object({ schoolYearId: idSchema.nullable(), assignmentId: idSchema.nullable(), revision: z.number().int().positive() }).strict()
  .refine(value => !value.assignmentId || !!value.schoolYearId, 'An assignment needs a school year.');
export const workInput = z.object({
  title: text(200), description: z.string().trim().max(4000),
  assignmentId: idSchema.nullable(), dueOn: date.nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
}).strict();
export const workStatusInput = z.object({ status: z.enum(['open', 'in_progress', 'completed', 'cancelled']), revision: z.number().int().positive() }).strict();
export const emailInput = z.object({ email: z.email().max(254) }).strict();
export const verifyEmailInput = emailInput.extend({ token: z.string().regex(/^\d{6,10}$/) }).strict();
export type ProfileInput = z.infer<typeof profileInput>;
export type YearInput = z.infer<typeof yearInput>;
export type AssignmentInput = z.infer<typeof assignmentInput>;
export type ContextInput = z.infer<typeof contextInput>;
export type WorkInput = z.infer<typeof workInput>;
export type WorkStatusInput = z.infer<typeof workStatusInput>;

export interface Identity { id: string; email: string }
export interface TeacherProfile { userId: string; displayName: string; timezone: string; workspaceId: string; selectedSchoolYearId: string | null; selectedAssignmentId: string | null; revision: number }
export interface Workspace { id: string; name: string; kind: 'personal' }
export interface SchoolYear extends YearInput { id: string; workspaceId: string }
export interface TeachingAssignment extends AssignmentInput { id: string; workspaceId: string; createdAt: string }
export interface WorkItem extends WorkInput { id: string; workspaceId: string; createdBy: string; source: 'manual'; status: WorkStatusInput['status']; completedAt: string | null; createdAt: string; revision: number }
export interface FoundationData { user: Identity; profile: TeacherProfile; workspace: Workspace; schoolYears: SchoolYear[]; assignments: TeachingAssignment[]; workItems: WorkItem[] }
export interface SessionInfo { configured: boolean; authenticated: boolean; fixture: boolean; email?: string }

/** Selection filters presentation only. It never mutates a work item's teaching context. */
export function visibleWork(items: WorkItem[], assignmentId: string | null) {
  return assignmentId ? items.filter(item => item.assignmentId === assignmentId || item.assignmentId === null) : items;
}
export function assignmentWithinYear(assignment: AssignmentInput, year: SchoolYear) {
  return assignment.schoolYearId === year.id && assignment.startsOn >= year.startsOn && assignment.endsOn <= year.endsOn;
}
