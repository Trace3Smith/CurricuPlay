import { createHash, randomUUID } from 'node:crypto';
import type { FoundationData } from '../../shared/contracts/foundation';
import { MAX_SOURCE_BYTES, activationInput, addVersionInput, proposalInput, resourceCreateInput, resourceEditInput, reviewInput, type OriginalInput, type ResourceMetadata, type ResourceVersion } from '../../shared/contracts/resources';
import { AppError } from '../ports';
import type { OriginalRecord, ResourcePorts } from './ports';
import { preview, readTabular, tabularAdapter } from '../ingestion/tabular';

export function resourceService(ports: ResourcePorts, context: FoundationData) {
  const { resources, originals } = ports;
  function metadataContext(metadata: ResourceMetadata) {
    if (metadata.schoolYearId && !context.schoolYears.some(y => y.id === metadata.schoolYearId)) throw new AppError(403, 'School year is unavailable.');
    if (metadata.assignmentIds.some(id => !context.assignments.some(a => a.id === id))) throw new AppError(403, 'Assignment is unavailable.');
  }
  async function detail(id: string) {
    const data = await resources.read(id);
    if (!data.resources.some(r => r.id === id)) throw new AppError(404, 'Resource is unavailable.');
    return data;
  }
  async function original(value: OriginalInput): Promise<OriginalRecord> {
    const id = randomUUID();
    if (value.kind === 'link') return { id, kind: 'link', externalUrl: value.url, fileName: null, mediaType: null, byteSize: 0, storageKey: null, sha256: createHash('sha256').update(value.url).digest('hex') };
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)) throw new AppError(400, 'Invalid file encoding.');
    const bytes = Buffer.from(value.base64, 'base64');
    if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new AppError(413, 'Upload a nonempty file up to 2 MiB.');
    readTabular(bytes, value.fileName); // Validate untrusted input before persisting any record or object.
    const mediaType = /\.csv$/i.test(value.fileName) ? 'text/csv' : 'application/json';
    const storageKey = `${context.workspace.id}/${id}/original`;
    await originals.put(storageKey, bytes, mediaType);
    return { id, kind: 'file', fileName: value.fileName, mediaType, byteSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), storageKey, externalUrl: null };
  }
  async function sourceBytes(version: ResourceVersion) {
    if (!version.storageKey || !version.fileName) throw new AppError(400, 'This is a bookmark. Upload a CSV or spreadsheet JSON snapshot to extract curriculum.');
    const bytes = await originals.read(version.storageKey);
    if (bytes.length !== version.byteSize || createHash('sha256').update(bytes).digest('hex') !== version.sha256) throw new AppError(409, 'The stored original failed its integrity check. Extraction has stopped.');
    return bytes;
  }
  async function version(resourceId: string, id: string) {
    const data = await detail(resourceId); const record = data.versions.find(v => v.id === id);
    if (!record) throw new AppError(404, 'Original version is unavailable.');
    return record;
  }
  return {
    list: () => resources.read(), detail,
    async create(input: unknown) { const value = resourceCreateInput.parse(input); metadataContext(value.metadata); return resources.save({ metadata: value.metadata, version: await original(value.original) }); },
    async edit(id: string, input: unknown) { const value = resourceEditInput.parse(input); await detail(id); metadataContext(value.metadata); return resources.save({ id, ...value }); },
    async addVersion(id: string, input: unknown) {
      const value = addVersionInput.parse(input); const data = await detail(id); const resource = data.resources[0];
      if (resource.revision !== value.revision) throw new AppError(409, 'This resource changed. Reload before uploading another version.');
      return resources.save({ id, revision: value.revision, metadata: resource.metadata, version: await original(value.original) });
    },
    async download(resourceId: string, id: string) { const record = await version(resourceId, id); return { record, bytes: await sourceBytes(record) }; },
    async preview(resourceId: string, id: string) { const record = await version(resourceId, id); return preview(readTabular(await sourceBytes(record), record.fileName!)); },
    async propose(resourceId: string, input: unknown) {
      const value = proposalInput.parse(input); const data = await detail(resourceId); const record = data.versions.find(v => v.id === value.resourceVersionId);
      if (!record) throw new AppError(404, 'Original version is unavailable.');
      if (value.supersedesId && !data.curriculum.some(c => c.id === value.supersedesId)) throw new AppError(400, 'Choose a prior version of this curriculum source.');
      const proposal = tabularAdapter.extract(readTabular(await sourceBytes(record), record.fileName!), value.mapping);
      if (Buffer.byteLength(JSON.stringify(proposal)) > 1200000) throw new AppError(413, 'Select fewer cells for this review.');
      return resources.propose({ ...value, proposal });
    },
    async review(resourceId: string, id: string, input: unknown) {
      const value = reviewInput.parse(input); const data = await detail(resourceId); const curriculum = data.curriculum.find(c => c.id === id);
      if (!curriculum) throw new AppError(404, 'Curriculum review is unavailable.');
      const assertions = curriculum.proposal.nodes.flatMap(n => n.assertions);
      if (Object.keys(value.decisions).some(key => !assertions.some(a => a.id === key))) throw new AppError(400, 'The review contains an unknown assertion.');
      if (value.approve) {
        if (assertions.some(a => !value.decisions[a.id]) || !assertions.some(a => value.decisions[a.id] === 'accept')) throw new AppError(400, 'Review every assertion and retain at least one before approval.');
        if (!value.acknowledgeLimitations) throw new AppError(400, 'Acknowledge the missing information and extraction limits.');
        if ((curriculum.proposal.conflicts.length || assertions.some(a => a.uncertainty.length && value.decisions[a.id] === 'accept')) && !value.note) throw new AppError(400, 'Explain how you handled conflicts and any retained uncertainty in the review note.');
      }
      await resources.review(id, value);
    },
    async activate(resourceId: string, id: string, input: unknown) {
      const value = activationInput.parse(input); const data = await detail(resourceId); const curriculum = data.curriculum.find(c => c.id === id);
      if (!curriculum || !data.reviews.find(r => r.curriculumVersionId === id)?.approvedAt) throw new AppError(400, 'Approve this curriculum review before activation.');
      const assignment = context.assignments.find(a => a.id === value.assignmentId);
      if (!assignment) throw new AppError(403, 'Assignment is unavailable.');
      const latest = data.bindings.filter(b => b.assignmentId === assignment.id).sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
      if (curriculum.effectiveFrom < assignment.startsOn || curriculum.effectiveTo > assignment.endsOn || (latest && curriculum.effectiveFrom <= latest.effectiveFrom)) throw new AppError(400, 'Effective dates must fit the assignment and start after its previous activation. Create a new proposal with the intended effective period.');
      return resources.activate(id, value);
    },
  };
}
