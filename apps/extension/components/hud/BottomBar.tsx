import { useRef, useEffect } from 'react';

interface BottomBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  isAiMode?: boolean;
}

export function BottomBar({ query, onQueryChange, isAiMode }: BottomBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06] shrink-0"
      style={{ background: 'rgba(0,0,0,0.3)' }}
    >
      <div
        className="flex-1 flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{
          background: 'rgba(255,255,255,0.06)',
          borderColor: isAiMode ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.10)',
        }}
      >
        {isAiMode ? (
          <span className="text-[11px] text-cyan-400/70 shrink-0">✦ AI</span>
        ) : (
          <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={isAiMode ? 'Describe the tab you\'re looking for…' : 'Search tabs… or "ai:" for history search'}
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
    </div>
  );
}
