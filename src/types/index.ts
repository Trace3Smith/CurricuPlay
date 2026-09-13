export const grades = ['K', '1', '2', '3', '4', '5'] as const;
export type Grade = typeof grades[number];
export const subjects = ['Literacy', 'Math', 'Science', 'Social Studies'] as const;
export type Subject = typeof subjects[number];
export type Category = Subject | 'Review';
export type ContentRange = 'recent' | 'all';
export interface Question {
  id: string; grade: Grade; subject: Subject; difficulty: 1 | 2 | 3;
  question: string; answer: string; standard: string; weekIntroduced: string; source: string;
  questionType?: string; choices?: string[]; teacherRead?: boolean; reviewQuestion?: boolean;
}
export interface CurriculumEntry {
  grade: Grade; weekOf: string; source: string;
  literacy?: { unit?: string; sessions?: string; standards?: string[] };
  math?: { standard?: string; standards?: string[] };
  science?: { standard?: string; standards?: string[] };
  socialStudies?: { standards?: string[] };
}
export interface Filters { grade: Grade; subject?: Category; difficulty?: number; range: ContentRange; asOf: string; unused?: boolean }
export interface GameState {
  version: 1; screen: 'home' | 'setup' | 'board' | 'question'; selectedGame: 'jeopardy' | null;
  grade: Grade; range: ContentRange; asOf: string; usedQuestionIds: string[]; usedTiles: string[];
  current: { questionId: string; tileId: string; category: Category; revealed: boolean } | null;
}
