import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import AppNav from '@/components/AppNav';

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto' });

export const metadata: Metadata = {
  title: 'LED Wall & Stage Calculator',
  description: 'Plan LED video walls and modular stage decks — panel counts, resolution, power, hardware, cabling, pricing, and event bookings, all in one place.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="antialiased">
        <div className="relative mx-auto min-h-screen w-full max-w-[480px] overflow-hidden bg-[var(--bg)]">
          <div className="pointer-events-none absolute -left-24 -bottom-24 size-96 rounded-full bg-white opacity-[0.01] blur-[110px]" />
          <div className="pointer-events-none absolute left-1/2 -top-48 size-96 -translate-x-1/2 rounded-full bg-white opacity-[0.01] blur-[110px]" />
          <main className="relative px-4 pb-32 pt-6">{children}</main>
          <AppNav />
        </div>
      </body>
    </html>
  );
}
