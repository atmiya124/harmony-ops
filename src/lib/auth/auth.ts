import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '../db/client';
import { authAccount, authSession, authUser, authVerification } from '../db/schema';
import { checkGoogleIdentity } from './allowlist';
import { AUTH_COOKIE_PREFIX } from './constants';

// Server-only. Reads BETTER_AUTH_SECRET and BETTER_AUTH_URL from the
// environment (see .env.example); Google is the only way in.
export const auth = betterAuth({
  appName: 'Harmony Ops',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    // Keyed by Better Auth's model names; the tables themselves are the
    // `auth_*` tables in schema.ts.
    schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // Always show Google's account chooser — partners may be signed in to
      // several Google accounts on the same phone.
      prompt: 'select_account',
    },
  },
  user: {
    // Runs on account creation, account linking and every Google sign-in
    // (with the fresh Google profile), so removing an address from
    // PARTNER_EMAILS locks that person out at their next sign-in.
    validateUserInfo: ({ user, source }) => {
      if (source.method !== 'oauth' || source.oauth?.providerId !== 'google') {
        return { error: 'google_only', errorDescription: 'Sign in with Google.' };
      }
      const profileVerified = source.oauth.profile?.email_verified;
      return checkGoogleIdentity(user.email as string | undefined, user.emailVerified ?? profileVerified);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // slide the expiry forward at most once a day
    // Short-lived signed cache so every request doesn't hit Turso; a revoked
    // session stops working within this window.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
  },
  onAPIError: {
    // Rejected sign-ins (not a partner, unverified email) land back on the
    // login page with ?error=<code>.
    errorURL: '/login',
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
