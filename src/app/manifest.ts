import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Harmony Ops',
    short_name: 'Harmony Ops',
    description: 'LED wall and stage calculators, plus AI-assisted event booking.',
    start_url: '/',
    display: 'standalone',
    background_color: '#02080f',
    theme_color: '#02080f',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
