import { sql } from 'drizzle-orm';
import { documentSequences } from './schema';
import type { Tx } from './financeRepo';
import { formatDocumentNumber, INVOICE_NUMBER_PREFIX, QUOTE_NUMBER_PREFIX, type DocumentSequence } from '../sales/types';

const PREFIX: Record<DocumentSequence, string> = { quote: QUOTE_NUMBER_PREFIX, invoice: INVOICE_NUMBER_PREFIX };

// The next quote or invoice number. Must be called inside the transaction
// that inserts the document: the counter moves with one atomic UPSERT, so
// concurrent saves are serialised by the database and each gets its own
// number, and a failed insert rolls the counter back (no gaps). The UNIQUE
// index on the number column backs this up.
export async function nextDocumentNumber(tx: Tx, sequence: DocumentSequence): Promise<string> {
  const [row] = await tx
    .insert(documentSequences)
    .values({ name: sequence, lastValue: 1 })
    .onConflictDoUpdate({ target: documentSequences.name, set: { lastValue: sql`${documentSequences.lastValue} + 1` } })
    .returning({ value: documentSequences.lastValue });
  return formatDocumentNumber(PREFIX[sequence], row.value);
}
