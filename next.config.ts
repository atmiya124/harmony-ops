import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Keep pages already visited for 5 minutes, so switching back to a tab
    // or screen is instant instead of waiting for the server. Pages load
    // their data in the browser (and refresh it on every visit), so only the
    // page shell is reused, never stale data.
    staleTimes: {
      dynamic: 300,
    },
  },
};

export default nextConfig;
