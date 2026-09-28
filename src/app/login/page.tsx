import { redirect } from 'next/navigation';
import { getCurrentPartner } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/redirect';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

const ERROR_MESSAGES: Record<string, string> = {
  not_a_partner: 'That Google account is not approved for Harmony Ops. Sign in with your partner account.',
  email_not_verified: 'Your Google email address is not verified yet.',
  access_denied: 'Google sign-in was cancelled.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  if (await getCurrentPartner()) redirect(next);

  const errorCode = typeof params.error === 'string' ? params.error.toLowerCase() : undefined;
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.') : null;

  return (
    <div className="flex min-h-[70vh] flex-col justify-center">
      <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--flat-text-faint)]">Harmony Production</p>
        <p className="mt-1 text-xl font-bold text-white">Harmony Ops</p>
        <p className="mt-1 text-xs text-[var(--flat-text-faint)]">Partner access only. Sign in with your approved Google account.</p>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-3 py-2 text-xs text-[var(--neon-pink)]">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5">
          <GoogleSignInButton callbackURL={next} />
        </div>
      </div>
    </div>
  );
}
