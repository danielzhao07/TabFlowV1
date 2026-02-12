import { useEffect, useRef } from 'react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  windowFilter: 'all' | 'current';
  onWindowFilterChange: (filter: 'all' | 'current') => void;
  sortMode: 'mru' | 'domain' | 'title' | 'frecency';
  onSortModeChange: (mode: 'mru' | 'domain' | 'title' | 'frecency') => void;
}

const SORT_LABELS: Record<string, string> = {
  mru: 'Recent',
  frecency: 'Frequent',
  domain: 'Domain',
  title: 'A-Z',
};

export function SearchBar({ query, onQueryChange, windowFilter, onWindowFilterChange, sortMode, onSortModeChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const cycleSort = () => {
    if (sortMode === 'mru') onSortModeChange('frecency');
    else if (sortMode === 'frecency') onSortModeChange('domain');
    else if (sortMode === 'domain') onSortModeChange('title');
    else onSortModeChange('mru');
  };

  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
      <svg
        className="w-5 h-5 text-white/50 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search tabs..."
        className="flex-1 bg-transparent text-white text-base placeholder-white/40 outline-none"
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <button
          onClick={() => onQueryChange('')}
          className="text-white/40 hover:text-white/70 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
      <button
        onClick={cycleSort}
        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
          sortMode !== 'mru'
            ? 'bg-purple-400/20 text-purple-300 border border-purple-400/30'
            : 'bg-white/[0.06] text-white/40 border border-white/10 hover:text-white/60'
        }`}
        title="Cycle sort mode (Ctrl+S)"
      >
        {SORT_LABELS[sortMode]}
      </button>
      <button
        onClick={() => onWindowFilterChange(windowFilter === 'all' ? 'current' : 'all')}
        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
          windowFilter === 'current'
            ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
            : 'bg-white/[0.06] text-white/40 border border-white/10 hover:text-white/60'
        }`}
        title="Toggle window filter (Ctrl+F)"
      >
        {windowFilter === 'current' ? 'This window' : 'All windows'}
      </button>
    </div>
  );
}
