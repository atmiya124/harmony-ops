'use client';

import { useId } from 'react';

// The HP mark from logo-white.svg, redrawn to sit in Home's ember glow: the
// letters are a faint cool white warming toward the glow below them, the
// swoosh catches the orange light, and a soft highlight sweeps across it when
// Home opens (see .hero-logo-* in globals.css). Purely decorative.
const LETTERS = [
  'M231.54,49.16v36.91h-85.76v-36.91c-.05-6.79-1.33-13.17-3.88-19.09-2.5-5.92-6.03-11.13-10.52-15.62-4.49-4.49-9.7-8.02-15.57-10.57-5.92-2.55-12.25-3.83-19.04-3.88v171.69c.05,6.79,1.33,13.12,3.88,18.99,2.5,5.87,6.02,11.03,10.52,15.52,4.49,4.49,9.7,7.96,15.57,10.46,5.92,2.55,12.26,3.83,19.05,3.88v-85.46h85.76v85.46c6.79-.05,13.12-1.33,19.05-3.88,5.87-2.5,11.08-5.97,15.57-10.46,4.49-4.49,8.02-9.65,10.52-15.52,2.55-5.87,3.83-12.2,3.88-18.99V0c-6.79.05-13.12,1.33-19.04,3.88-5.87,2.55-11.08,6.08-15.57,10.57-4.49,4.49-7.96,9.7-10.52,15.62-2.55,5.92-3.83,12.3-3.88,19.09h0Z',
  'M400.02.31h-91.9c.05,6.79,1.33,13.12,3.88,19.04,2.5,5.87,6.02,11.08,10.52,15.57,4.49,4.49,9.7,7.97,15.57,10.52,5.92,2.55,12.26,3.83,19.05,3.88h42.88c3.42.05,6.48.87,9.24,2.5,2.81,1.63,5,3.83,6.64,6.64,1.63,2.76,2.45,5.82,2.5,9.24-.05,3.42-.87,6.48-2.5,9.24-1.63,2.76-3.83,5-6.64,6.64-2.75,1.63-5.82,2.45-9.24,2.5h-91.9v85.77c.05,6.79,1.33,13.12,3.88,19.04,2.5,5.87,6.02,11.08,10.52,15.57,4.49,4.49,9.7,8.02,15.57,10.52,5.92,2.55,12.26,3.83,19.05,3.88v-85.77h43.49c9.09-.05,17.67-1.84,25.68-5.36,8.02-3.52,15.11-8.37,21.29-14.55,6.13-6.18,10.98-13.33,14.45-21.44,3.52-8.12,5.31-16.8,5.36-26.04-.05-9.34-1.84-18.07-5.31-26.19-3.47-8.12-8.32-15.26-14.5-21.39-6.18-6.18-13.27-11.03-21.39-14.5-8.12-3.47-16.85-5.26-26.19-5.31h0Z',
];
const LETTER_ACCENTS = [
  'M177,86.08h-31.23v-11.01c-16.21-5.24-32.83-9.81-49.01-13.05v12.9c40.06,9.57,93.49,29.13,162,67.2,7.44,4.13,14.7,7.82,21.79,11.1v-19.43c-5.1-2.5-10.3-5.2-15.6-8.15-5.77-3.21-42.55-22.31-87.95-39.56h0Z',
  'M308.12,145.58v18.67c17.57,5.89,33.9,9.09,49.01,10.13v-17.26c-14.98-1.43-31.28-5.09-49.01-11.54h0Z',
];
const SWOOSH = 'M258.76,162.21C75.68,60.46.22,90.92,0,91.01c64.46-49.25,251.3,47.14,264.94,54.72,178.94,99.45,238.88-62.91,239.06-63.37-5.26,49.35-82.43,170.35-245.24,79.86h0Z';
const SWOOSH_SHADOW = 'M258.76,151.27C75.68,49.5.22,79.97,0,80.05c64.46-49.25,251.3,47.14,264.94,54.72,178.94,99.45,238.88-62.91,239.06-63.37-5.26,49.35-82.43,170.35-245.24,79.87h0Z';

export default function HeroLogo({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const letters = `${id}-letters`;
  const swoosh = `${id}-swoosh`;
  const shine = `${id}-shine`;
  const shape = `${id}-shape`;

  return (
    <svg aria-hidden viewBox="0 0 504 220.85" className={`hero-logo-float pointer-events-none overflow-visible ${className}`}>
      <defs>
        {/* Cool white at the top, picking up the ember toward the bottom. */}
        <linearGradient id={letters} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.6" stopColor="#ffd9b8" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={swoosh} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff9a4a" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ffb070" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffd2a0" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={shape} maskUnits="userSpaceOnUse" x="0" y="0" width="504" height="221">
          {[...LETTERS, ...LETTER_ACCENTS, SWOOSH].map((d) => (
            <path key={d} d={d} fill="#fff" />
          ))}
        </mask>
      </defs>

      {LETTERS.map((d) => (
        <path key={d} d={d} fill={`url(#${letters})`} />
      ))}
      {LETTER_ACCENTS.map((d) => (
        <path key={d} d={d} fill="#ffb070" fillOpacity="0.14" fillRule="evenodd" />
      ))}
      <path d={SWOOSH_SHADOW} fill="#ff8a3a" fillOpacity="0.18" />
      <path d={SWOOSH} fill={`url(#${swoosh})`} />

      {/* A narrow band of light, clipped to the mark, sweeping left to right. */}
      <g mask={`url(#${shape})`}>
        <g className="hero-logo-shine">
          <rect x="-160" y="-20" width="160" height="260" fill={`url(#${shine})`} transform="skewX(-20)" />
        </g>
      </g>
    </svg>
  );
}
