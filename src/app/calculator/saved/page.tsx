'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bookmark, Trash2 } from 'lucide-react';
import { PENDING_LOAD_KEY, SAVED_CONFIGS_KEY, SavedConfig } from '@/lib/led-panels';
import { alpha, calcColors as c } from '@/lib/calc-theme';

export default function SavedConfigsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<SavedConfig[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_CONFIGS_KEY);
      if (raw) setConfigs(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const persist = (next: SavedConfig[]) => {
    setConfigs(next);
    try {
      window.localStorage.setItem(SAVED_CONFIGS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleDelete = (id: string) => {
    persist(configs.filter((cfg) => cfg.id !== id));
  };

  const handleLoad = (config: SavedConfig) => {
    try {
      window.localStorage.setItem(PENDING_LOAD_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
    router.push('/calculator');
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const categoryColor = (category: SavedConfig['panel']['category']) => {
    if (category === 'indoor') return c.cyan;
    if (category === 'outdoor') return c.orange;
    return c.purple;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div className="rounded-[24px] border p-5 sm:p-7" style={{ backgroundColor: c.background, borderColor: c.border }}>
        <div className="mb-5">
          <h1 className="text-[32px] font-bold tracking-tight" style={{ color: c.foreground }}>
            Saved
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: c.mutedForeground }}>
            Configurations
          </p>
        </div>

        {configs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 pt-16 text-center">
            <Bookmark className="size-12" style={{ color: c.mutedForeground }} />
            <p className="text-lg font-semibold" style={{ color: c.foreground }}>
              No Saved Configurations
            </p>
            <p className="text-sm" style={{ color: c.mutedForeground }}>
              Calculate a wall and save it from the Calculator page.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => {
              const accent = categoryColor(config.panel.category);
              return (
                <button
                  key={config.id}
                  type="button"
                  onClick={() => handleLoad(config)}
                  className="w-full overflow-hidden rounded-2xl border p-4 text-left"
                  style={{ backgroundColor: c.card, borderColor: c.border }}
                >
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex flex-1 items-center gap-3">
                      <span
                        className="inline-flex min-w-[52px] items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-bold"
                        style={{ backgroundColor: alpha(accent, '22'), color: accent }}
                      >
                        {config.panel.name}
                      </span>
                      <div>
                        <p className="text-base font-semibold" style={{ color: c.foreground }}>
                          {config.name}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: c.mutedForeground }}>
                          {formatDate(config.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(config.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleDelete(config.id);
                        }
                      }}
                      className="p-1.5"
                      aria-label="Delete configuration"
                    >
                      <Trash2 className="size-[18px]" style={{ color: c.destructive }} />
                    </span>
                  </div>

                  <div className="border-t" style={{ borderColor: c.border, marginInline: -16 }} />

                  <div className="mt-3.5 flex flex-wrap gap-3">
                    <Stat label="Grid" value={`${config.cols} × ${config.rows}`} />
                    <Stat label="Wall Size" value={`${config.result.wallWidthM.toFixed(1)} × ${config.result.wallHeightM.toFixed(1)} m`} />
                    <Stat label="Resolution" value={`${config.result.totalPixelsW.toLocaleString()}×${config.result.totalPixelsH.toLocaleString()}`} />
                    <Stat label="Panels" value={String(config.result.totalPanels)} />
                    <Stat label="Flight Boxes" value={`${Math.ceil(config.result.totalPanels / 8)} boxes`} />
                    <Stat label="Area" value={`${config.result.areaFt2.toFixed(1)} ft²`} />
                  </div>

                  <div className="mt-3.5 flex items-center justify-center gap-1.5 border-t pt-3" style={{ borderColor: c.border }}>
                    <span className="text-sm font-semibold" style={{ color: c.primary }}>
                      Load Configuration
                    </span>
                    <ArrowRight className="size-3.5" style={{ color: c.primary }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[30%] flex-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.3px]" style={{ color: c.mutedForeground }}>
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: c.foreground }}>
        {value}
      </p>
    </div>
  );
}
