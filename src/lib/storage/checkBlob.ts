// Usage: npm run storage:check
//
// Verifies the Vercel Blob store is set up for private receipts: writes a
// tiny test file with access 'private', reads it back through the SDK,
// confirms its URL can NOT be fetched without the token, then deletes it.
// Touches nothing but its own healthcheck/ file.
import { randomUUID } from 'node:crypto';
import { del, get, put } from '@vercel/blob';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set in .env');
  const key = `healthcheck/${randomUUID()}.txt`;
  const body = `harmony-ops private storage check ${new Date().toISOString()}`;

  const stored = await put(key, body, { access: 'private', contentType: 'text/plain', addRandomSuffix: false });
  try {
    const back = await get(key, { access: 'private', useCache: false });
    const text = back?.stream ? await new Response(back.stream).text() : null;
    if (text !== body) throw new Error('Read-back did not match what was written');
    console.log('write + read with token: OK');

    const anonymous = await fetch(stored.url);
    if (anonymous.ok) throw new Error(`The blob URL is publicly readable (HTTP ${anonymous.status}) — the store must be private`);
    console.log(`direct URL without token: blocked (HTTP ${anonymous.status}) — OK`);
  } finally {
    await del(stored.url);
    console.log('test file deleted');
  }
  console.log('Vercel Blob private storage is ready for receipts.');
}

main().catch((err) => {
  console.error('Storage check FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
