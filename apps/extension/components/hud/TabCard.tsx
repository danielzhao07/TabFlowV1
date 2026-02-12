import { useState } from 'react';
import type { TabInfo } from '@/lib/types';

interface TabCardProps {
  tab: TabInfo;
  isSelected: boolean;
  isMultiSelected: boolean;
  isDuplicate: boolean;
  isBookmarked: boolean;
  mruPosition: number;
  query: string;
  onClick: () => void;
  onClose: (tabId: number) => void;
  onTogglePin: (tabId: number, pinned: boolean) => void;
  onToggleSelect: (tabId: number, shiftKey: boolean) => void;
  onToggleBookmark: (tabId: number) => void;
  showUrl?: boolean;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function domainColor(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 60%, 65%)`;
}

function FaviconFallback({ domain }: { domain: string }) {
  const letter = domain.charAt(0).toUpperCase();
  const color = domainColor(domain);
  return (
    <div
      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold"
      style={{ backgroundColor: color + '25', color }}
    >
      {letter}
    </div>
  );
}

const GROUP_COLORS: Record<string, string> = {
  grey: '#9CA3AF',
  blue: '#60A5FA',
  red: '#F87171',
  yellow: '#FBBF24',
  green: '#34D399',
  pink: '#F472B6',
  purple: '#A78BFA',
  cyan: '#22D3EE',
  orange: '#FB923C',
};

// Highlight matching parts of text based on query
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);

  if (idx === -1) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-cyan-300 bg-cyan-400/15 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function TabCard({ tab, isSelected, isMultiSelected, isDuplicate, isBookmarked, mruPosition, query, onClick, onClose, onTogglePin, onToggleSelect, onToggleBookmark, showUrl = true }: TabCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const domain = getDomain(tab.url);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggleSelect(tab.tabId, false);
    } else if (e.shiftKey) {
      e.preventDefault();
      onToggleSelect(tab.tabId, true);
    } else {
      onClick();
    }
  };

  return (
    <div
      className={`
        group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 cursor-pointer
        ${isMultiSelected
          ? 'bg-cyan-400/[0.12] border-l-2 border-l-cyan-400'
          : isSelected
            ? 'bg-white/[0.12] border-l-2 border-l-cyan-400'
            : 'hover:bg-white/[0.06] border-l-2 border-l-transparent'}
      `}
      onClick={handleClick}
    >
      {/* MRU position / shortcut key */}
      {mruPosition <= 9 ? (
        <kbd className="w-5 h-5 rounded bg-white/[0.06] text-center text-[10px] text-white/35 tabular-nums shrink-0 flex items-center justify-center font-mono">
          {mruPosition}
        </kbd>
      ) : (
        <span className="w-5 text-center text-[11px] text-white/20 tabular-nums shrink-0">
          {mruPosition}
        </span>
      )}

      {/* Favicon */}
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        {tab.faviconUrl && !faviconError ? (
          <img
            src={tab.faviconUrl}
            alt=""
            className="w-5 h-5 rounded-sm"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <FaviconFallback domain={domain} />
        )}
      </div>

      {/* Tab info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-white/90 truncate leading-tight">
            <HighlightText text={tab.title || 'Untitled'} query={query} />
          </span>
          {tab.isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
          )}
          {tab.isPinned && (
            <svg className="w-3 h-3 text-white/40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          )}
          {tab.isAudible && (
            <svg className="w-3 h-3 text-cyan-400/70 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            </svg>
          )}
          {tab.groupColor && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none"
              style={{
                backgroundColor: (GROUP_COLORS[tab.groupColor] || '#9CA3AF') + '25',
                color: GROUP_COLORS[tab.groupColor] || '#9CA3AF',
              }}
            >
              {tab.groupTitle || 'Group'}
            </span>
          )}
          {tab.isDiscarded && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none bg-white/10 text-white/35">
              Suspended
            </span>
          )}
          {isDuplicate && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none bg-amber-400/20 text-amber-400">
              Dupe
            </span>
          )}
          {isMultiSelected && (
            <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )}
        </div>
        {showUrl && (
          <div className="flex items-center gap-2 text-[11px] text-white/30 leading-tight mt-0.5">
            <span className="truncate">
              <HighlightText text={domain} query={query} />
            </span>
            {!tab.isActive && (
              <span className="shrink-0 text-white/20">{timeAgo(tab.lastAccessed)}</span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark(tab.tabId);
        }}
        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/15 transition-all ${
          isBookmarked ? 'opacity-60 text-yellow-400' : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-yellow-400'
        }`}
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark tab'}
      >
        <svg className="w-3 h-3" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(tab.tabId, !tab.isPinned);
        }}
        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/15 transition-all ${
          tab.isPinned ? 'opacity-60 text-white/50' : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/70'
        }`}
        title={tab.isPinned ? 'Unpin tab' : 'Pin tab'}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.tabId);
        }}
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/15 text-white/40 hover:text-red-400 transition-all"
        title="Close tab"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Selection indicator */}
      {isSelected && (
        <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-white/10 text-white/50 text-[10px] font-mono">
          ↵
        </kbd>
      )}
    </div>
  );
}
