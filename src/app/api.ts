/** The browser knows the ClassThread HTTP contract, not its infrastructure provider. */
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, method = 'GET', value?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: 'same-origin', cache: 'no-store', signal,
      ...(value === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'You appear to be offline. Your changes have not been saved. Reconnect and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error ?? 'The request could not be completed.');
  return data as T;
}
