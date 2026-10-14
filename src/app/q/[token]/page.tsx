import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import ClientQuoteView, { ClientQuoteFooter, ClientQuoteHeader } from '@/components/clientQuote/ClientQuoteView';
import { getPublicQuote } from '@/lib/db/clientLinkRepo';
import { todayInFinanceTz } from '@/lib/finance/today';

// The client's quote, opened from the secret link Harmony shared. Public (no
// sign-in) — the token is the only key, and the quote is loaded from it on
// the server. Not indexed, and the URL is never sent on as a referrer.
export const metadata: Metadata = {
  title: 'Your quote · Harmony Production',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <ClientQuoteHeader />
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-6 py-12 text-center">
        <Lock size={26} className="text-[var(--ink-3)]" aria-hidden />
        <h1 className="text-[20px] font-semibold">{title}</h1>
        <p className="max-w-md text-[15px] text-[var(--ink-2)]">{children}</p>
      </div>
      <div className="text-center">
        <ClientQuoteFooter />
      </div>
    </div>
  );
}

export default async function ClientQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token, todayInFinanceTz()).catch((err) => {
    console.error('[client quote] load failed:', err instanceof Error ? err.message : 'unknown error');
    return undefined;
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:pt-10">
      {quote === undefined ? (
        <Message title="Something went wrong">We couldn’t load this quote right now. Please try again in a moment.</Message>
      ) : quote === null ? (
        <Message title="This link isn’t valid">This quote link is no longer active. Please contact Harmony Production for a new link.</Message>
      ) : quote.state === 'unavailable' ? (
        <Message title="This quote isn’t available">It may still be in preparation or has been withdrawn. Please contact Harmony Production.</Message>
      ) : (
        <>
          <h1 className="sr-only">
            Quote {quote.quoteNumber} for {quote.customer.name}
          </h1>
          <ClientQuoteView quote={quote} token={token} />
        </>
      )}
    </div>
  );
}
