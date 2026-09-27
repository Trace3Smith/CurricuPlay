import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';
import { AppError } from '../../ports';
import type { ResourcePorts, ResourceRepository } from '../../resources/ports';
import type { ResourceLibrary } from '../../../shared/contracts/resources';

export type ResourceRpc = 'resource_library' | 'save_resource' | 'propose_curriculum' | 'review_curriculum' | 'activate_curriculum';
export type ResourceTransport = (name: ResourceRpc, args: Record<string, unknown>) => Promise<unknown>;
// Database row shape is confined to this provider boundary. Domains and UI use camel case.
function camel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camel);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()),
    ['metadata','proposal','mapping','decisions'].includes(key) ? item : camel(item)]));
}
export function resourceRepository(transport: ResourceTransport): ResourceRepository {
  return {
    async read(resourceId) {
      const data = camel(await transport('resource_library', { p_resource_id: resourceId ?? null })) as ResourceLibrary;
      // List responses omit large review payloads. Full detail always contains them.
      for (const version of data.curriculum) version.proposal ??= { adapter: 'tabular-v1', nodes: [], missing: [], conflicts: [], warnings: [] };
      for (const review of data.reviews) review.decisions ??= {};
      return data;
    },
    async save(value) { return await transport('save_resource', { p: value }) as string; },
    async propose(value) { return await transport('propose_curriculum', { p: value }) as string; },
    async review(id, value) { await transport('review_curriculum', { p: { id, ...value } }); },
    async activate(id, value) { return await transport('activate_curriculum', { p: { id, ...value } }) as string; },
  };
}
export function resourceDatabaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === '40001' || error.code === '23505') throw new AppError(409, 'This record changed or was finalized in another tab. Reload before trying again.');
  if (error.code === '42501') throw new AppError(403, 'This resource or teaching context is unavailable.');
  if (error.code === '23514' || error.code === '23503') throw new AppError(400, 'Check the review, source relationships, and effective dates before saving.');
  throw new AppError(503, 'Resources are unavailable. Check the Increment 2 migration and private storage setup.');
}
export function supabaseResourcePorts(client: SupabaseClient<Database>): ResourcePorts {
  return {
    resources: resourceRepository(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      resourceDatabaseError(error); return data;
    }),
    originals: {
      async put(key, bytes, mediaType) {
        const { error } = await client.storage.from('classthread-resources').upload(key, bytes, { contentType: mediaType, upsert: false, cacheControl: '0' });
        if (error) throw new AppError(503, 'The original could not be stored. Check the private Resources bucket and policies.');
      },
      async read(key) {
        const { data, error } = await client.storage.from('classthread-resources').download(key);
        if (error || !data) throw new AppError(503, 'The original is unavailable. Try again or check private storage.');
        return new Uint8Array(await data.arrayBuffer());
      },
    },
  };
}
