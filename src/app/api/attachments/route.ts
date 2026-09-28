import { NextResponse } from 'next/server';
import { withPartner } from '@/lib/auth/session';
import { createAttachment } from '@/lib/db/financeRepo';
import { detectReceiptFileType, MAX_RECEIPT_BYTES } from '@/lib/storage/fileType';
import { financeErrorResponse } from '@/lib/api/financeHttp';

// Uploads one receipt (multipart/form-data, field "file") to private
// storage and returns its attachment id, which the expense then references.
// The file type is decided from the file's bytes, not the browser's claim.
export const POST = withPartner(async (req, { partner }) => {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_RECEIPT_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Receipt is too large (4 MB max)' }, { status: 413 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get('file');
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: 'Send the receipt as multipart/form-data with a "file" field' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'No receipt file received' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'The receipt file is empty' }, { status: 400 });
  if (file.size > MAX_RECEIPT_BYTES) return NextResponse.json({ error: 'Receipt is too large (4 MB max)' }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectReceiptFileType(bytes);
  if (!type) return NextResponse.json({ error: 'Receipts must be a photo (JPEG, PNG, WebP) or a PDF' }, { status: 415 });

  try {
    const attachment = await createAttachment({ bytes, type, originalFilename: file.name || null }, partner);
    return NextResponse.json(attachment, { status: 201 });
  } catch (err) {
    return financeErrorResponse(err, 'upload receipt');
  }
});
