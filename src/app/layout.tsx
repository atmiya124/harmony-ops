import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { HarmonyShell } from '@/components/harmony-shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Harmony Ops',
  description: 'Unified calculator and event operations platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="bg-slate-950 text-slate-100 antialiased">
        <HarmonyShell>{children}</HarmonyShell>
      </body>
    </html>
  );
}
