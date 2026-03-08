'use client';

import type { SessionLocation } from '@lib/types';

interface SessionLocationMapProps {
  location: SessionLocation | null;
}

function formatCoordinate(value: number | null, positive: string, negative: string): string {
  if (value === null) {
    return 'Unknown';
  }

  const suffix = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}° ${suffix}`;
}

export function SessionLocationMap({ location }: SessionLocationMapProps) {
  if (!location || location.latitude === null || location.longitude === null) {
    return null;
  }

  const markerLeft = `${((location.longitude + 180) / 360) * 100}%`;
  const markerTop = `${((90 - location.latitude) / 180) * 100}%`;
  const label = [location.city, location.region, location.country].filter(Boolean).join(', ');

  return (
    <aside className="pointer-events-none absolute right-6 top-6 z-30 w-80 overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-950/75 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
          Session Origin
        </div>
        <div className="mt-2 text-lg font-semibold text-white">
          {label || 'Approximate IP-based location'}
        </div>
      </div>

      <div className="p-5">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.95))]">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full opacity-70"
            viewBox="0 0 100 56"
          >
            <defs>
              <pattern id="geo-grid" width="10" height="8" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 8" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.35" />
              </pattern>
            </defs>

            <rect width="100" height="56" fill="url(#geo-grid)" />
            <path d="M7 20c4-5 9-8 14-8 2 0 3 2 5 3 4 2 6 2 8 4 1 2 1 4-1 5-4 2-8 2-11 5-2 2-5 1-8 0-4-2-8-4-8-9 0-1 0-1 1 0Z" fill="rgba(56,189,248,0.14)" />
            <path d="M34 12c4-2 10-2 14 1 2 2 4 4 7 4 5 1 8 4 9 7 0 3-2 6-5 7-4 2-8 1-10 5-2 3-5 5-10 5-5 0-9-3-12-7-2-4-3-7-2-11 2-4 4-8 9-11Z" fill="rgba(34,197,94,0.16)" />
            <path d="M61 16c3-2 7-3 11-2 3 1 5 3 8 4 4 1 8 3 11 6 2 2 3 5 1 7-2 2-6 3-9 3-4 1-6 3-8 6-2 3-6 4-10 2-4-2-7-6-8-10-2-4 0-10 4-16Z" fill="rgba(250,204,21,0.14)" />
            <path d="M73 39c2-2 5-2 7 0 2 1 4 3 6 5 1 2 1 4-1 5-2 1-5 1-7 0-2-1-4-3-5-5-1-2-1-4 0-5Z" fill="rgba(248,113,113,0.16)" />
          </svg>

          <div
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.16),0_0_26px_rgba(34,211,238,0.55)]"
            style={{ left: markerLeft, top: markerTop }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="uppercase tracking-[0.22em] text-slate-500">Latitude</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {formatCoordinate(location.latitude, 'N', 'S')}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="uppercase tracking-[0.22em] text-slate-500">Longitude</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {formatCoordinate(location.longitude, 'E', 'W')}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          Approximate IP-based location while this website session is active.
        </div>
      </div>
    </aside>
  );
}
