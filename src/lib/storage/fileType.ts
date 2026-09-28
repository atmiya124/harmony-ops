// Identifies an uploaded receipt from its first bytes, ignoring whatever
// file name or Content-Type the browser claimed. Only formats every browser
// can display are accepted; the app converts phone photos (including HEIC)
// to JPEG before upload.

export interface ReceiptFileType {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export function detectReceiptFileType(bytes: Uint8Array): ReceiptFileType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: 'image/png', extension: 'png' };
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return { contentType: 'image/webp', extension: 'webp' };
  if (startsWith(bytes, ascii('%PDF-'))) return { contentType: 'application/pdf', extension: 'pdf' };
  return null;
}

// Vercel functions accept request bodies up to 4.5 MB; the app compresses
// photos well below this before uploading.
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
