import { useState } from 'react';
import type { TabInfo } from '@/lib/types';

interface GroupSuggestionsProps {
  tabs: TabInfo[];
  onGroup: (tabIds: number[], domain: string) => void;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function GroupSuggestions({ tabs, onGroup }: GroupSuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Find domains with 3+ ungrouped tabs
  const domainMap = new Map<string, { tabIds: number[]; domain: string }>();
  for (const tab of tabs) {
    if (tab.groupId || !tab.url || tab.url === 'chrome://newtab/') continue;
    const domain = getDomain(tab.url);
    if (!domain) continue;
    const existing = domainMap.get(domain);
    if (existing) existing.tabIds.push(tab.tabId);
    else domainMap.set(domain, { tabIds: [tab.tabId], domain });
  }

  const suggestions = [...domainMap.values()]
    .filter((s) => s.tabIds.length >= 3 && !dismissed.has(s.domain))
    .sort((a, b) => b.tabIds.length - a.tabIds.length)
    .slice(0, 3);

  if (suggestions.length === 0) return null;

  return (
    <div className="border-t border-white/10 px-5 py-2">
      <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5">Suggested groups</p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.domain}
            onClick={() => onGroup(s.tabIds, s.domain)}
            className="group/sug flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-cyan-400/10 hover:border-cyan-400/20 transition-colors"
          >
            <svg className="w-3 h-3 text-white/30 group-hover/sug:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-[11px] text-white/50 group-hover/sug:text-white/80">
              {s.domain.split('.')[0]}
            </span>
            <span className="text-[10px] text-white/25">{s.tabIds.length}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDismissed((prev) => new Set([...prev, s.domain]));
              }}
              className="ml-0.5 text-white/20 hover:text-white/50"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
