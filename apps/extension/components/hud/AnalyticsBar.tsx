import { useState, useEffect } from 'react';
import { getTopDomains, type DomainStat } from '@/lib/api-client';
import { getFrecencyMap } from '@/lib/frecency';

interface LocalDomainStat { domain: string; visits: number; }

function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AnalyticsBar() {
  const [domains, setDomains] = useState<DomainStat[]>([]);
  const [localDomains, setLocalDomains] = useState<LocalDomainStat[]>([]);

  useEffect(() => {
    // Try cloud analytics; fall back to local frecency counts
    getTopDomains(5).then(setDomains).catch(() => {});
    getFrecencyMap().then((map) => {
      const counts = new Map<string, number>();
      for (const [url, entry] of map) {
        try {
          const d = new URL(url).hostname.replace('www.', '');
          if (d) counts.set(d, (counts.get(d) ?? 0) + entry.visitCount);
        } catch { /* ignore */ }
      }
      const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([domain, visits]) => ({ domain, visits }));
      setLocalDomains(sorted);
    }).catch(() => {});
  }, []);

  const showCloud = domains.length > 0;
  const showLocal = !showCloud && localDomains.length > 0;
  if (!showCloud && !showLocal) return null;

  if (showCloud) {
    const maxVisits = Math.max(...domains.map((d) => Number(d.total_visits)));
    return (
      <div className="flex items-center gap-3 px-4 overflow-x-auto">
        <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0">Top sites</span>
        {domains.map((d) => {
          const pct = Math.round((Number(d.total_visits) / maxVisits) * 100);
          return (
            <div key={d.domain} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-white/40">{d.domain}</span>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden" style={{ width: 40 }}>
                <div className="h-full rounded-full bg-cyan-400/40" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[9px] text-white/20">{formatTime(Number(d.total_duration_ms))}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Local frecency fallback
  const maxLocal = Math.max(...localDomains.map((d) => d.visits));
  return (
    <div className="flex items-center gap-3 px-4 overflow-x-auto">
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0">Top sites</span>
      {localDomains.map((d) => {
        const pct = Math.round((d.visits / maxLocal) * 100);
        return (
          <div key={d.domain} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-white/40">{d.domain}</span>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden" style={{ width: 40 }}>
              <div className="h-full rounded-full bg-white/20" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[9px] text-white/20">{d.visits}v</span>
          </div>
        );
      })}
    </div>
  );
}
