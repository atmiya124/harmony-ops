// Shrinks a phone photo before upload: phone cameras produce 3–12 MB images
// (often HEIC on iPhone), the server accepts 4 MB, and mobile data is slow.
// Redrawing through a canvas also converts HEIC to JPEG and drops EXIF
// metadata (including GPS location) from the receipt.

const MAX_EDGE = 2000; // px — plenty to read small receipt print
const JPEG_QUALITY = 0.82;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface PreparedReceipt {
  blob: Blob;
  filename: string;
  previewUrl: string | null; // object URL for a thumbnail; null for PDFs
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photo format isn't supported on this device. Try a screenshot or PDF."));
    };
    img.src = url;
  });
}

export async function prepareReceipt(file: File): Promise<PreparedReceipt> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('This PDF is over 4 MB. Try a photo of the receipt instead.');
    return { blob: file, filename: file.name || 'receipt.pdf', previewUrl: null };
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process this photo');
  ctx.fillStyle = '#ffffff'; // transparent PNG screenshots -> white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = JPEG_QUALITY;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob) throw new Error('Could not process this photo');
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('This photo is too large even after compressing.');
  return { blob, filename: 'receipt.jpg', previewUrl: URL.createObjectURL(blob) };
}
