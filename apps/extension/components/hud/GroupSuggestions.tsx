import { useMemo, useState } from 'react';
import type { TabInfo } from '@/lib/types';
import type { TabActions } from '@/lib/hooks/useTabActions';

// Chrome's actual muted/pastel group colors
const GROUP_COLORS: Record<string, string> = {
  blue: '#8ab4f8', cyan: '#78d9ec', green: '#81c995', yellow: '#fdd663',
  orange: '#fcad70', red: '#f28b82', pink: '#ff8bcb', purple: '#c58af9',
  grey: '#9aa0a6',
};

interface GroupSuggestionsProps {
  tabs: TabInfo[];
  actions: TabActions;
  selectedTabs?: Set<number>;
  groupFilter?: Set<number>;
  onGroupFilterToggle?: (groupId: number) => void;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

export function GroupSuggestions({
  tabs, actions, selectedTabs, groupFilter, onGroupFilterToggle,
}: GroupSuggestionsProps) {
  const [hoveredGroupId, setHoveredGroupId] = useState<number | null>(null);

  const suggestions = useMemo(() => {
    const domainMap = new Map<string, TabInfo[]>();
    for (const tab of tabs) {
      if (tab.groupId) continue;
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

  const existingGroups = useMemo(() => {
    const groups = new Map<number, { groupId: number; title: string; color: string; count: number }>();
    for (const tab of tabs) {
      if (!tab.groupId || !tab.groupColor) continue;
      const existing = groups.get(tab.groupId);
      if (existing) existing.count++;
      else groups.set(tab.groupId, {
        groupId: tab.groupId,
        title: tab.groupTitle || getDomain(tab.url),
        color: GROUP_COLORS[tab.groupColor] ?? '#9aa0a6',
        count: 1,
      });
    }
    return [...groups.values()].slice(0, 6);
  }, [tabs]);

  const hasMultiSelect = (selectedTabs?.size ?? 0) > 1;

  if (suggestions.length === 0 && existingGroups.length === 0 && !hasMultiSelect) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0 overflow-x-auto"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}
    >
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0">Groups</span>

      {/* Existing groups — clickable to filter, hover X to dissolve */}
      {existingGroups.map((g) => {
        const isActive = groupFilter?.has(g.groupId) ?? false;
        return (
          <button
            key={g.groupId}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 transition-all"
            style={{
              backgroundColor: isActive ? g.color + '22' : g.color + '0e',
              border: `1px solid ${isActive ? g.color + '50' : g.color + '22'}`,
              outline: 'none',
            }}
            onClick={() => onGroupFilterToggle?.(g.groupId)}
            onMouseEnter={() => setHoveredGroupId(g.groupId)}
            onMouseLeave={() => setHoveredGroupId(null)}
            title={isActive ? `Showing only "${g.title}" — click to clear filter` : `Filter to "${g.title}" group`}
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
            <span className="text-[10px]" style={{ color: g.color }}>{g.title}</span>
            <span className="text-[9px] text-white/20">{g.count}</span>

            {/* Hover-reveal close/dissolve button */}
            <span
              className="transition-all overflow-hidden flex items-center"
              style={{ width: hoveredGroupId === g.groupId ? 14 : 0, opacity: hoveredGroupId === g.groupId ? 1 : 0 }}
            >
              <span
                role="button"
                className="ml-0.5 w-3 h-3 flex items-center justify-center rounded-sm hover:bg-red-500/60 transition-colors"
                style={{ color: g.color + 'cc' }}
                onClick={(e) => { e.stopPropagation(); actions.dissolveGroup(g.groupId); }}
                title={`Dissolve "${g.title}" group`}
              >
                <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </span>
          </button>
        );
      })}

      {/* Divider if both exist */}
      {existingGroups.length > 0 && (suggestions.length > 0 || hasMultiSelect) && (
        <div className="w-px h-3 bg-white/10 shrink-0" />
      )}

      {/* Group selected tabs button */}
      {hasMultiSelect && (
        <button
          onClick={() => actions.groupSelectedTabs()}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 border border-white/[0.10] bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/[0.18] transition-colors"
          title={`Group ${selectedTabs!.size} selected tabs`}
        >
          <svg className="w-2.5 h-2.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-[10px] text-white/50">Group {selectedTabs!.size} tabs</span>
        </button>
      )}

      {/* Domain suggestions */}
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
