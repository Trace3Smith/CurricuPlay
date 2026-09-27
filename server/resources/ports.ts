import type { ActivationInput, CurriculumProposal, ProposalInput, ResourceLibrary, ResourceMetadata, ResourceVersion, ReviewInput } from '../../shared/contracts/resources';

export type OriginalRecord = Omit<ResourceVersion, 'resourceId' | 'number' | 'createdAt' | 'metadata'>;
export interface ResourceRepository {
  read(resourceId?: string): Promise<ResourceLibrary>;
  save(value: { id?: string; revision?: number; metadata: ResourceMetadata; version?: OriginalRecord }): Promise<string>;
  propose(value: ProposalInput & { proposal: CurriculumProposal }): Promise<string>;
  review(id: string, value: ReviewInput): Promise<void>;
  activate(id: string, value: ActivationInput): Promise<string>;
}
/** Private immutable object storage, authenticated as the current user, never service-role. */
export interface OriginalStorage {
  put(key: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  read(key: string): Promise<Uint8Array>;
}
export interface ResourcePorts { resources: ResourceRepository; originals: OriginalStorage }
