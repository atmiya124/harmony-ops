'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

// A drawn signature: mouse, finger or stylus (pointer events, so it works the
// same on phones and desktops). Reports a small transparent PNG data URL, or
// null while empty. Drawing needs a pointer; typing a signature is the
// keyboard-accessible alternative offered alongside it.
const EXPORT_WIDTH = 600;
const EXPORT_HEIGHT = 200;

export default function SignaturePad({ onChange, labelledBy }: { onChange: (dataUrl: string | null) => void; labelledBy: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Match the canvas resolution to its on-screen size (sharp on retina).
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f1f22';
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function exportPng() {
    const canvas = canvasRef.current!;
    const out = document.createElement('canvas');
    out.width = EXPORT_WIDTH;
    out.height = EXPORT_HEIGHT;
    out.getContext('2d')!.drawImage(canvas, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    onChange(out.toDataURL('image/png'));
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    // A dot for a single tap.
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1f1f22';
    ctx.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setEmpty(false);
    exportPng();
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby={labelledBy}
          aria-describedby="signature-pad-help"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="block h-[180px] w-full cursor-crosshair touch-none rounded-lg border border-[var(--line-strong)] bg-[var(--paper)]"
        />
        {/* Signature line, like on paper. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-[var(--line-strong)]" />
        {empty ? (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] text-[var(--ink-3)]">
            Sign here
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p id="signature-pad-help" className="text-[12px] text-[var(--ink-3)]">
          Draw with your finger, stylus or mouse.
        </p>
        <button type="button" onClick={clear} disabled={empty} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-[var(--ink-2)] hover:bg-[var(--paper-sunk)] disabled:opacity-40">
          <Eraser size={14} /> Clear
        </button>
      </div>
    </div>
  );
}
