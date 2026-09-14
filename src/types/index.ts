export const grades = ['K', '1', '2', '3', '4', '5'] as const;
export type Grade = typeof grades[number];
export const subjects = ['Literacy', 'Math', 'Science', 'Social Studies'] as const;
export type Subject = typeof subjects[number];
export type Category = Subject | 'Review';
export type ContentRange = 'recent' | 'all';
export interface Question {
  packId?: string; packName?: string; originId?: string; approvalBasis?: string; verificationEvidence?: Partial<SourceEvidence>;
  id: string; grade: Grade; subject: Subject; difficulty: 1 | 2 | 3;
  question: string; answer: string; standard: string | null; weekIntroduced: string; source: string;
  curriculumId?: string; curriculumIds?: string[]; alignedWeeks?: string[];
  standardSource?: string; sourceUrl?: string; unit?: string | null; session?: string | null; evidence?: SourceEvidence;
  reviewStatus?: 'pending' | 'approved' | 'needs-edit' | 'rejected'; reviewNote?: string; teacherSetup?: string;
  requiresExternalClassroomMaterial: boolean; materialReviewNote?: string;
  questionType?: string; choices?: string[]; teacherRead?: boolean; reviewQuestion?: boolean;
}
export interface SourceEvidence {
  document: string; sourceUrl: string; sourceTitle: string; section: string;
  quote: string; characterOffset: number; timingBasis: string;
}
export interface CurriculumEntry {
  id: string; grade: Grade; subject: Subject | 'Science & Social Studies';
  weekOf: string | null; instructionalWeek: number | null; quarter: string | null;
  source: string; sourceUrl: string; sourceSheet: string; sourceRow: number; sourceDateText: string;
  sourceCells: { cell: string; text: string; links: string[]; headerSourceUrl?: string }[];
  standardReferences: string[]; unitReferences: string[]; sessionReferences: string[];
  generationStatus: 'needs_additional_source_material' | 'needs_timing_review' | 'partially_supported';
  needsAdditionalSourceMaterial: boolean; reason: string; supportingEvidence: SourceEvidence[];
}
export interface Filters { grade: Grade; subject?: Category; difficulty?: number; range: ContentRange; asOf: string; unused?: boolean }
export interface GameState {
  version: 1; screen: 'home' | 'setup' | 'board' | 'question'; selectedGame: 'jeopardy' | null;
  grade: Grade; range: ContentRange; asOf: string; usedQuestionIds: string[]; usedTiles: string[];
  contentSource?: 'classroom' | 'drafts';
  assignments?: Record<string, string>;
  current: { questionId: string; tileId: string; category: Category; revealed: boolean } | null;
}
