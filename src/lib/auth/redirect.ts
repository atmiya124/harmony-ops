// Only same-origin, path-relative redirect targets are honoured after sign-in
// — `next=//evil.com` or `next=https://…` would otherwise be an open redirect.
export function safeNextPath(next: string | string[] | undefined | null): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/api/')) return '/';
  return value;
}
