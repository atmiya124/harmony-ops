// A partner's short display name: their first name once they've signed in
// with Google, otherwise the capitalised local part of their email.
export function partnerLabel(p: { email: string; name: string | null }): string {
  if (p.name) return p.name.split(' ')[0];
  const local = p.email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}
