import { useMemo } from 'react';
import type { TabInfo } from '@/lib/types';
import type { TabActions } from '@/lib/hooks/useTabActions';

const GROUP_COLORS: Record<string, string> = {
  blue: '#3b82f6', cyan: '#06b6d4', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', red: '#ef4444', pink: '#ec4899', purple: '#a855f7',
  grey: '#6b7280',
};

interface GroupSuggestionsProps {
  tabs: TabInfo[];
  actions: TabActions;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

export function GroupSuggestions({ tabs, actions }: GroupSuggestionsProps) {
  const suggestions = useMemo(() => {
    // Find ungrouped tabs, group by domain, only suggest domains with 2+ ungrouped tabs
    const domainMap = new Map<string, TabInfo[]>();
    for (const tab of tabs) {
      if (tab.groupId) continue; // already in a group
      const d = getDomain(tab.url);
      if (!d) continue;
      const existing = domainMap.get(d);
      if (existing) existing.push(tab);
      else domainMap.set(d, [tab]);
    }
    return [...domainMap.entries()]
      .filter(([, tabList]) => tabList.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4);
  }, [tabs]);

  // Find domains that already have a group (to show existing groups)
  const existingGroups = useMemo(() => {
    const groups = new Map<number, { title: string; color: string; count: number }>();
    for (const tab of tabs) {
      if (!tab.groupId || !tab.groupColor) continue;
      const existing = groups.get(tab.groupId);
      if (existing) existing.count++;
      else groups.set(tab.groupId, {
        title: tab.groupTitle || getDomain(tab.url),
        color: GROUP_COLORS[tab.groupColor] ?? '#6b7280',
        count: 1,
      });
    }
    return [...groups.values()].slice(0, 4);
  }, [tabs]);

  if (suggestions.length === 0 && existingGroups.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0 overflow-x-auto"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}
    >
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0">Groups</span>

      {/* Existing groups */}
      {existingGroups.map((g) => (
        <div
          key={g.title + g.color}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0"
          style={{ backgroundColor: g.color + '18', border: `1px solid ${g.color}30` }}
        >
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
          <span className="text-[10px]" style={{ color: g.color }}>{g.title}</span>
          <span className="text-[9px] text-white/20">{g.count}</span>
        </div>
      ))}

      {/* Divider if both exist */}
      {existingGroups.length > 0 && suggestions.length > 0 && (
        <div className="w-px h-3 bg-white/10 shrink-0" />
      )}

      {/* Suggestions */}
      {suggestions.map(([domain, tabList]) => (
        <button
          key={domain}
          onClick={() => actions.groupSuggestionTabs(tabList.map((t) => t.tabId), domain)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.12] transition-colors"
          title={`Group ${tabList.length} ${domain} tabs together`}
        >
          <svg className="w-2.5 h-2.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-[10px] text-white/40">{domain}</span>
          <span className="text-[9px] text-white/20">{tabList.length}</span>
        </button>
      ))}
    </div>
  );
}
