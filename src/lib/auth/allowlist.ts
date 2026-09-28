// Access to Harmony Ops is limited to the four Harmony Production partners.
// The approved addresses live in the PARTNER_EMAILS environment variable
// (comma-separated) — never in source or in the shared `partner_settings`
// table, which another app can edit.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parsePartnerEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(/[,;\s]+/)
      .map(normalizeEmail)
      .filter((e) => e.includes('@')),
  );
}

export function getPartnerEmails(): Set<string> {
  return parsePartnerEmails(process.env.PARTNER_EMAILS);
}

// Optional display names, from PARTNER_NAMES as comma-separated
// `email=Name` pairs (e.g. "someone@gmail.com=Atmiya, other@gmail.com=Ankit").
// Kept separate from PARTNER_EMAILS so a typo in a name can never affect
// who is allowed to sign in. Partners without an entry fall back to their
// Google name.
export function parsePartnerNames(raw: string | undefined): Map<string, string> {
  const names = new Map<string, string>();
  for (const entry of (raw ?? '').split(/[,;\n]+/)) {
    const eq = entry.indexOf('=');
    if (eq < 0) continue;
    const email = normalizeEmail(entry.slice(0, eq));
    const name = entry.slice(eq + 1).trim();
    if (email.includes('@') && name) names.set(email, name);
  }
  return names;
}

export function getPartnerNames(): Map<string, string> {
  return parsePartnerNames(process.env.PARTNER_NAMES);
}

// The name to show for a partner: the configured one, else the fallback
// (their Google name), else the part of the email before "@".
export function partnerDisplayName(email: string, fallback?: string | null, names: Map<string, string> = getPartnerNames()): string {
  return names.get(normalizeEmail(email)) || fallback?.trim() || email.split('@')[0];
}

export function isApprovedPartner(email: string | null | undefined, allowlist: Set<string> = getPartnerEmails()): boolean {
  if (!email) return false;
  return allowlist.has(normalizeEmail(email));
}

// The decision Better Auth's `validateUserInfo` hook makes on every Google
// sign-in and account creation. Google must have verified the address —
// otherwise anyone could create a Google account claiming a partner's
// email — and the address must be on the allowlist.
export function checkGoogleIdentity(
  email: string | null | undefined,
  emailVerified: unknown,
  allowlist: Set<string> = getPartnerEmails(),
): { error: string; errorDescription: string } | undefined {
  if (emailVerified !== true) {
    return { error: 'email_not_verified', errorDescription: 'Your Google email address is not verified.' };
  }
  if (!isApprovedPartner(email, allowlist)) {
    return { error: 'not_a_partner', errorDescription: 'This Google account is not approved for Harmony Ops.' };
  }
  return undefined;
}
