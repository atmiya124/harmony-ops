// Browser-side JSON requests to the app's API. Errors carry the server's
// message and per-field messages so forms can show them next to the right
// input, plus the current record on a 409 (someone else saved first).

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string[]> = {},
    public current?: unknown,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('No connection. Check your signal and try again.', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.fieldErrors ?? {}, body?.current);
  }
  return body as T;
}

export const json = (method: string, data?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: data === undefined ? undefined : JSON.stringify(data),
});
