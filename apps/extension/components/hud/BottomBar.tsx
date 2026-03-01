import { useRef, useEffect } from 'react';

interface BottomBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  isAiMode?: boolean;
  onAiClick?: () => void;
  onAiSubmit?: (query: string) => void;
}

export function BottomBar({ query, onQueryChange, isAiMode, onAiClick, onAiSubmit }: BottomBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isAiMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isAiMode && val === '@' && onAiClick) {
      onAiClick();
      onQueryChange('');
      return;
    }
    onQueryChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAiMode && e.key === 'Enter' && query.trim() && onAiSubmit) {
      e.preventDefault();
      onAiSubmit(query.trim());
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 shrink-0"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    >
      <div
        className="flex-1 flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderColor: isAiMode ? 'rgba(160,140,255,0.4)' : 'rgba(255,255,255,0.06)',
        }}
      >
        {isAiMode ? (
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 15l-1.5-4.5L2 8l4.5-1.5L8 1z" fill="rgba(160,140,255,0.7)" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isAiMode ? 'Ask AI to manage your tabs…' : 'Search tabs...'}
          className="flex-1 bg-transparent text-[13px] placeholder-white/20 outline-none"
          style={{ color: isAiMode ? 'rgba(200,190,255,0.85)' : 'rgba(255,255,255,0.7)' }}
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            className="text-white/20 hover:text-white/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* AI sparkle button — rotating border glow wrapper */}
      <div className="ai-glow-btn">
        {/* Rotating conic-gradient that forms the glowing border */}
        <div className="ai-glow-spinner" />
        <button
          onClick={onAiClick}
          title="AI tab agent (@)"
          className="flex items-center justify-center rounded-lg transition-all"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 30,
            height: 30,
            background: isAiMode ? 'rgba(40,30,80,0.97)' : 'rgba(14,12,28,0.95)',
            color: isAiMode ? 'rgba(180,160,255,0.9)' : 'rgba(255,255,255,0.35)',
          }}
          onMouseEnter={(e) => {
            if (!isAiMode) {
              (e.currentTarget as HTMLElement).style.color = 'rgba(180,160,255,0.8)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAiMode) {
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)';
            }
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 15l-1.5-4.5L2 8l4.5-1.5L8 1z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
