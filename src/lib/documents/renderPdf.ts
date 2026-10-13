// HTML -> PDF with headless Chromium. Server-only: the browser never sees the
// engine, only the finished PDF from the API route.
//
// Where Chromium comes from:
//   - Vercel / AWS Lambda: @sparticuz/chromium (a serverless build).
//   - Elsewhere (local dev, tests): an installed Chrome/Chromium — set
//     CHROME_EXECUTABLE_PATH, or the usual install paths are tried.
import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { DocumentLayout } from './layoutScript';

const LOCAL_CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const isServerless = () => Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export function localChromePath(): string | null {
  const configured = process.env.CHROME_EXECUTABLE_PATH;
  if (configured) return configured;
  return LOCAL_CHROME_PATHS.find((p) => existsSync(p)) ?? null;
}

async function launch(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const executablePath = localChromePath();
  if (!executablePath) throw new Error('No Chrome/Chromium found for PDF rendering. Install Chrome or set CHROME_EXECUTABLE_PATH.');
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
}

// One browser per server instance, reused across requests (starting
// Chromium is the slow part). If it dies, the next request starts another.
let browser: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = launch().then((b) => {
      b.on('disconnected', () => {
        browser = null;
      });
      return b;
    });
    browser.catch(() => {
      browser = null;
    });
  }
  return browser;
}

export async function closePdfBrowser(): Promise<void> {
  const b = browser;
  browser = null;
  if (b) await (await b).close().catch(() => {});
}

export interface RenderedPdf {
  pdf: Uint8Array;
  layout: DocumentLayout;
}

export async function renderPdf(html: string): Promise<RenderedPdf> {
  const page = await (await getBrowser()).newPage();
  try {
    // The document is self-contained: refuse any network request it might
    // try to make (it shouldn't make any).
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') void req.continue();
      else void req.abort();
    });
    await page.setViewport({ width: 794, height: 1123 });
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction('window.__layout !== undefined', { timeout: 20_000 });
    const layout = (await page.evaluate('window.__layout')) as DocumentLayout;
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return { pdf, layout };
  } finally {
    await page.close().catch(() => {});
  }
}
