import type { AssignmentInput, ContextInput, FoundationData, ProfileInput, WorkInput, WorkStatusInput, YearInput } from '../shared/contracts/foundation';

/** Provider subjects stay behind this boundary; API callers receive the application user ID. */
export interface AuthIdentity { subject: string; email: string }
export interface AuthPort {
  currentUser(): Promise<AuthIdentity | null>;
  startGoogle(redirectTo: string): Promise<string>;
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, token: string): Promise<void>;
  exchangeCode(code: string): Promise<void>;
  signOut(): Promise<void>;
}
export interface FoundationRepository {
  bootstrap(): Promise<void>;
  read(identity: AuthIdentity): Promise<FoundationData>;
  updateProfile(userId: string, value: ProfileInput): Promise<void>;
  selectContext(userId: string, value: ContextInput): Promise<void>;
  createYear(workspaceId: string, value: YearInput): Promise<void>;
  createAssignment(workspaceId: string, value: AssignmentInput): Promise<void>;
  createWork(workspaceId: string, userId: string, value: WorkInput): Promise<void>;
  updateWork(workspaceId: string, id: string, value: WorkStatusInput): Promise<void>;
}
export interface RequestPorts { auth: AuthPort; repository: FoundationRepository }
export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
