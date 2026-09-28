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
