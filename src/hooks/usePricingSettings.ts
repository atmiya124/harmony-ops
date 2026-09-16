'use client';

import { useEffect, useState } from 'react';
import { getPricingSettings, PricingSettings } from '@/lib/pricingApi';
import { DEFAULT_LED_RATE } from '@/lib/ledCalculator';
import { DEFAULT_STAGE_RATE } from '@/lib/stageCalculator';

const DEFAULTS: PricingSettings = { ledPricePerSqft: DEFAULT_LED_RATE, stagePricePerPanel: DEFAULT_STAGE_RATE };

// Falls back to the hardcoded defaults (silently) if the settings can't be
// loaded — pricing is still shown, just not the team's configured rate.
//
// Also refetches whenever the page becomes visible again (tab refocused, or
// restored from the browser's back/forward cache) — otherwise a rate saved
// on the Settings page wouldn't show up on a Calculator page that was
// already open, since the initial fetch only runs once on mount.
export function usePricingSettings() {
  const [rates, setRates] = useState<PricingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getPricingSettings()
        .then((data) => {
          if (!cancelled) setRates(data);
        })
        .catch(() => {
          // keep whatever rates are already showing
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return { rates, loading };
}
