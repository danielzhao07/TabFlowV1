import { useState, useEffect } from 'react';
import { getTopDomains, type DomainStat } from '@/lib/api-client';
import { getFrecencyMap } from '@/lib/frecency';
import type { TabInfo } from '@/lib/types';

interface LocalDomainStat { domain: string; visits: number; }

interface AnalyticsBarProps {
  tabs?: TabInfo[];
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

function titleForDomain(domain: string, tabs: TabInfo[]): string {
  const match = tabs.find((t) => {
    try { return new URL(t.url).hostname.replace('www.', '') === domain; } catch { return false; }
  });
  return match?.title || domain;
}

export function AnalyticsBar({ tabs = [] }: AnalyticsBarProps) {
  const [domains, setDomains] = useState<DomainStat[]>([]);
  const [localDomains, setLocalDomains] = useState<LocalDomainStat[]>([]);

  useEffect(() => {
    getTopDomains(3).then(setDomains).catch(() => {});
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
        .slice(0, 3)
        .map(([domain, visits]) => ({ domain, visits }));
      setLocalDomains(sorted);
    }).catch(() => {});
  }, []);

  const showCloud = domains.length > 0;
  const showLocal = !showCloud && localDomains.length > 0;
  if (!showCloud && !showLocal) return null;

  const items = showCloud
    ? domains.map((d) => ({ key: d.domain, label: titleForDomain(d.domain, tabs) }))
    : localDomains.map((d) => ({ key: d.domain, label: titleForDomain(d.domain, tabs) }));

  return (
    <div className="flex items-center gap-2 overflow-hidden flex-nowrap">
      <span className="text-[9px] text-white/15 uppercase tracking-wider shrink-0">Today</span>
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-2 shrink-0">
          {i > 0 && <span className="text-white/10 text-[9px]">·</span>}
          <span className="text-[10px] text-white/35 truncate max-w-[160px]">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
