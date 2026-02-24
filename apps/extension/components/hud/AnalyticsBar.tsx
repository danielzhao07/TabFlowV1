import { useState, useEffect } from 'react';
import { getTopDomains, type DomainStat } from '@/lib/api-client';

export function AnalyticsBar() {
  const [domains, setDomains] = useState<DomainStat[]>([]);

  useEffect(() => {
    getTopDomains(4).then(setDomains).catch(() => {});
  }, []);

  if (domains.length === 0) return null;

  const maxVisits = Math.max(...domains.map((d) => Number(d.total_visits)));

  function formatTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  return (
    <div className="flex items-center gap-3 px-4 overflow-x-auto">
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0">Top sites</span>
      {domains.map((d) => {
        const pct = Math.round((Number(d.total_visits) / maxVisits) * 100);
        return (
          <div key={d.domain} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-white/40">{d.domain}</span>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden" style={{ width: 40 }}>
              <div
                className="h-full rounded-full bg-cyan-400/40"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-white/20">{formatTime(Number(d.total_duration_ms))}</span>
          </div>
        );
      })}
    </div>
  );
}
