import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AppNav from '@/components/AppNav';
import ProfileMenu from '@/components/auth/ProfileMenu';
import { getCurrentPartner } from '@/lib/auth/session';
import { LOGIN_PATH, PATHNAME_HEADER } from '@/lib/auth/constants';

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto' });

export const metadata: Metadata = {
  title: 'Harmony Ops',
  description: 'Plan LED video walls and modular stage decks — panel counts, resolution, power, hardware, cabling, pricing, and event bookings, all in one place.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Authoritative session check on every full page load. The proxy has
  // already bounced requests with no session cookie at all; this catches a
  // cookie whose session is expired, revoked, or no longer on the allowlist.
  const path = (await headers()).get(PATHNAME_HEADER) ?? '';
  const isLoginPage = path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`);
  const partner = await getCurrentPartner();
  if (!partner && !isLoginPage) redirect(path && path !== '/' ? `${LOGIN_PATH}?next=${encodeURIComponent(path)}` : LOGIN_PATH);

  return (
    <html lang="en" className={roboto.variable}>
      <body className="antialiased">
        <div className="relative mx-auto min-h-screen w-full max-w-[480px] overflow-hidden bg-[var(--bg)]">
          <div className="pointer-events-none absolute -left-24 -bottom-24 size-96 rounded-full bg-white opacity-[0.01] blur-[110px]" />
          <div className="pointer-events-none absolute left-1/2 -top-48 size-96 -translate-x-1/2 rounded-full bg-white opacity-[0.01] blur-[110px]" />
          {partner && !isLoginPage ? (
            <>
              <header className="relative z-40 flex justify-end px-4 pt-4">
                <ProfileMenu partner={partner} />
              </header>
              <main className="relative px-4 pb-32 pt-3">{children}</main>
              <AppNav />
            </>
          ) : (
            <main className="relative px-4 pb-16 pt-6">{children}</main>
          )}
        </div>
      </body>
    </html>
  );
}
