import { z } from 'zod';
import { idSchema } from './foundation';

const label = (max: number) => z.string().trim().min(1).max(max);
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const resourceTypes = ['pacing_guide', 'standards', 'support_document', 'template', 'assessment', 'classroom_material', 'other'] as const;
export const authorityPurposes = ['timing', 'sequence', 'standard_wording', 'clarification', 'vocabulary', 'instructional_detail', 'methods_materials'] as const;
export const curriculumFields = ['unit', 'topic', 'window', 'sequence', 'standards', 'objectives', 'essential_questions', 'vocabulary', 'assessments', 'resources', 'notes', 'prerequisites'] as const;
export type CurriculumField = typeof curriculumFields[number];
export const fieldLabels: Record<CurriculumField, string> = { unit: 'Unit', topic: 'Topic', window: 'Instructional window', sequence: 'Sequence', standards: 'Standards references (unverified)', objectives: 'Learning targets / objectives', essential_questions: 'Essential questions', vocabulary: 'Vocabulary', assessments: 'Assessments', resources: 'Linked resources', notes: 'Instructional notes', prerequisites: 'Prerequisites / relationships' };

/** Links are bookmarks only: never fetched, followed, or used as authority to act. */
export function isSafeResourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      /^[a-z0-9.-]+$/i.test(url.hostname) && url.hostname.includes('.') &&
      !/^(\d+\.){3}\d+$/.test(url.hostname) && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname);
  } catch { return false; }
}
export const resourceUrl = z.string().max(2000).refine(isSafeResourceUrl, 'Use a public HTTPS link without credentials or a custom port.');
export const metadataInput = z.object({
  title: label(160), description: z.string().trim().max(4000), type: z.enum(resourceTypes),
  origin: z.enum(['district', 'state', 'teacher', 'publisher', 'other']), sourceName: label(200),
  subject: z.string().trim().max(120), course: z.string().trim().max(150),
  grades: z.array(label(40)).max(30), standards: z.array(label(100)).max(100), tags: z.array(label(50)).max(30),
  schoolYearId: idSchema.nullable(), assignmentIds: z.array(idSchema).max(100),
}).strict();
export type ResourceMetadata = z.infer<typeof metadataInput>;
export const originalInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), fileName: label(180).regex(/^[^/\\\x00-\x1f]+\.(csv|json)$/i, 'Upload a CSV or spreadsheet JSON snapshot.'), base64: z.string().min(4).max(Math.ceil(MAX_SOURCE_BYTES / 3) * 4) }).strict(),
  z.object({ kind: z.literal('link'), url: resourceUrl }).strict(),
]);
export const resourceCreateInput = z.object({ metadata: metadataInput, original: originalInput }).strict();
export const resourceEditInput = z.object({ metadata: metadataInput, revision: z.number().int().positive() }).strict();
export const addVersionInput = z.object({ original: originalInput, revision: z.number().int().positive() }).strict();
export type OriginalInput = z.infer<typeof originalInput>;

export const mappingInput = z.object({
  sheet: label(120), firstRow: z.number().int().min(1).max(10000), lastRow: z.number().int().min(1).max(10000),
  columns: z.array(z.object({ field: z.enum(curriculumFields), column: z.string().regex(/^[A-Z]{1,3}$/) }).strict()).min(1).max(30),
}).strict().refine(v => v.lastRow >= v.firstRow && v.lastRow - v.firstRow < 500, 'Select at most 500 rows in order.')
  .refine(v => new Set(v.columns.map(c => c.column)).size === v.columns.length, 'Map each column once.');
export type ColumnMapping = z.infer<typeof mappingInput>;
export const proposalInput = z.object({
  resourceVersionId: idSchema, label: label(160), effectiveFrom: z.iso.date(), effectiveTo: z.iso.date(),
  purposes: z.array(z.enum(authorityPurposes)).min(1).max(7), mapping: mappingInput, supersedesId: idSchema.nullable(),
}).strict().refine(v => v.effectiveTo >= v.effectiveFrom, 'The end date must follow the start date.');
export type ProposalInput = z.infer<typeof proposalInput>;
export interface Citation { sheet: string; row: number; cell: string; quote: string; url?: string }
export interface Assertion { id: string; field: CurriculumField; text: string; citation: Citation; provenance: 'extracted'; confidence: 'literal'; uncertainty: string[] }
export interface CurriculumNode { id: string; row: number; assertions: Assertion[] }
export interface CurriculumProposal { adapter: 'tabular-v1'; nodes: CurriculumNode[]; missing: CurriculumField[]; warnings: string[]; conflicts: { id: string; message: string; assertionIds: string[] }[] }
export const reviewInput = z.object({
  revision: z.number().int().positive(), approve: z.boolean(),
  decisions: z.record(z.string().max(80), z.enum(['accept', 'exclude'])),
  note: z.string().trim().max(4000), acknowledgeLimitations: z.boolean(),
}).strict();
export type ReviewInput = z.infer<typeof reviewInput>;
export const activationInput = z.object({ assignmentId: idSchema, expectedBindingId: idSchema.nullable() }).strict();
export type ActivationInput = z.infer<typeof activationInput>;

export interface Resource { id: string; workspaceId: string; metadata: ResourceMetadata; revision: number; createdAt: string; updatedAt: string }
export interface ResourceVersion { metadata: ResourceMetadata; id: string; resourceId: string; number: number; kind: 'file' | 'link'; fileName: string | null; mediaType: string | null; byteSize: number; sha256: string; storageKey: string | null; externalUrl: string | null; createdAt: string }
export interface CurriculumSource { id: string; resourceId: string; createdAt: string }
export interface SourceVersion { id: string; sourceId: string; resourceVersionId: string; purposes: typeof authorityPurposes[number][]; mapping: ColumnMapping; createdAt: string }
export interface CurriculumVersion { id: string; sourceVersionId: string; label: string; effectiveFrom: string; effectiveTo: string; supersedesId: string | null; proposal: CurriculumProposal; createdAt: string }
export interface CurriculumReview { curriculumVersionId: string; revision: number; decisions: ReviewInput['decisions']; note: string; acknowledgeLimitations: boolean; approvedAt: string | null; reviewedBy: string | null }
export interface CurriculumBinding { id: string; assignmentId: string; curriculumVersionId: string; previousBindingId: string | null; effectiveFrom: string; effectiveTo: string; createdAt: string }
export interface ResourceLibrary { resources: Resource[]; versions: ResourceVersion[]; sources: CurriculumSource[]; sourceVersions: SourceVersion[]; curriculum: CurriculumVersion[]; reviews: CurriculumReview[]; bindings: CurriculumBinding[] }
export interface GridPreview { sheets: { name: string; hidden: boolean; rowCount: number; columns: string[]; sample: { row: number; cells: Record<string, string> }[] }[] }

/** A later activation cuts over on its effective date; neither record is overwritten. */
export function activeBinding(bindings: CurriculumBinding[], assignmentId: string, on: string) {
  const current = bindings.filter(b => b.assignmentId === assignmentId && b.effectiveFrom <= on).sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return current && current.effectiveTo >= on ? current : undefined;
}
