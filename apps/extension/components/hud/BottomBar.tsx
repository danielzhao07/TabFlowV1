import { useRef, useEffect } from 'react';
import type { TabInfo } from '@/lib/types';

interface BottomBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  tabCount: number;
  totalCount: number;
  selectedCount: number;
  duplicateCount: number;
  windowFilter: 'all' | 'current';
  onWindowFilterChange: (f: 'all' | 'current') => void;
  sortMode: 'mru' | 'domain' | 'title' | 'frecency';
  onSortModeChange: (m: 'mru' | 'domain' | 'title' | 'frecency') => void;
  onCloseSelected: () => void;
  onCloseDuplicates: () => void;
  tabs: TabInfo[];
  onGroupSuggestion?: (tabIds: number[], domain: string) => void;
}

const SORT_LABELS: Record<string, string> = { mru: 'MRU', frecency: 'Freq', domain: 'Domain', title: 'A-Z' };

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

function GroupSuggestions({ tabs, onGroupSuggestion }: { tabs: TabInfo[]; onGroupSuggestion?: (ids: number[], domain: string) => void }) {
  if (!onGroupSuggestion) return null;
  const domainMap = new Map<string, number[]>();
  for (const t of tabs) {
    if (t.groupId || !t.url || t.url === 'chrome://newtab/') continue;
    const d = getDomain(t.url);
    if (!d) continue;
    const arr = domainMap.get(d) ?? [];
    arr.push(t.tabId);
    domainMap.set(d, arr);
  }
  const suggestions = [...domainMap.entries()].filter(([, ids]) => ids.length >= 3).slice(0, 3);
  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/[0.06]">
      <span className="text-[10px] text-white/25 uppercase tracking-wider shrink-0">Group</span>
      {suggestions.map(([domain, ids]) => (
        <button
          key={domain}
          onClick={() => onGroupSuggestion(ids, domain)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-cyan-400/10 hover:border-cyan-400/20 transition-colors text-[11px] text-white/40 hover:text-white/70"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {domain.split('.')[0]}
          <span className="text-white/20">{ids.length}</span>
        </button>
      ))}
    </div>
  );
}

export function BottomBar({
  query, onQueryChange, tabCount, totalCount, selectedCount, duplicateCount,
  windowFilter, onWindowFilterChange, sortMode, onSortModeChange,
  onCloseSelected, onCloseDuplicates, tabs, onGroupSuggestion,
}: BottomBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const cycleSortMode = () => {
    const modes: Array<typeof sortMode> = ['mru', 'frecency', 'domain', 'title'];
    const idx = modes.indexOf(sortMode);
    onSortModeChange(modes[(idx + 1) % modes.length]);
  };

  return (
    <div
      className="border-t border-white/[0.08]"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    >
      <GroupSuggestions tabs={tabs} onGroupSuggestion={onGroupSuggestion} />

      {/* Status row */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-[11px] text-white/30">
          {tabCount < totalCount ? `${tabCount} of ${totalCount}` : totalCount} tabs
        </span>
        {selectedCount > 0 && (
          <button
            onClick={onCloseSelected}
            className="text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
          >
            Close {selectedCount} selected
          </button>
        )}
        {duplicateCount > 0 && (
          <button
            onClick={onCloseDuplicates}
            className="text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            {duplicateCount} dupes
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {/* Window filter */}
          <button
            onClick={() => onWindowFilterChange(windowFilter === 'all' ? 'current' : 'all')}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
              windowFilter === 'current'
                ? 'bg-cyan-400/20 text-cyan-400'
                : 'text-white/25 hover:text-white/50'
            }`}
          >
            {windowFilter === 'current' ? 'This window' : 'All windows'}
          </button>
          {/* Sort mode */}
          <button
            onClick={cycleSortMode}
            className="px-2 py-0.5 rounded text-[10px] text-white/25 hover:text-white/50 transition-colors"
          >
            {SORT_LABELS[sortMode]}
          </button>
        </div>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/[0.12] px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <svg className="w-4 h-4 text-white/25 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search tabs… or type > for commands"
            className="flex-1 bg-transparent text-[13px] text-white/80 placeholder-white/25 outline-none"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Shortcut hints */}
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-white/20">
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] font-mono">↑↓←→</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] font-mono">⏎</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] font-mono">?</kbd>
        </div>
      </div>
    </div>
  );
}
