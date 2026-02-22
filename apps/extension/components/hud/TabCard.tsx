import { useState, useRef, useEffect, useCallback } from 'react';
import type { TabInfo } from '@/lib/types';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { SnoozeMenu } from './SnoozeMenu';

interface TabCardProps {
  tab: TabInfo;
  isSelected: boolean;
  isMultiSelected: boolean;
  isDuplicate: boolean;
  isBookmarked: boolean;
  mruPosition: number;
  query: string;
  note?: string;
  onClick: () => void;
  onClose: (tabId: number) => void;
  onTogglePin: (tabId: number, pinned: boolean) => void;
  onToggleSelect: (tabId: number, shiftKey: boolean) => void;
  onToggleBookmark: (tabId: number) => void;
  onSaveNote: (tabId: number, url: string, note: string) => void;
  onSnooze: (tabId: number, durationMs: number) => void;
  onMoveToWindow: (tabId: number, windowId: number) => void;
  onToggleMute: (tabId: number) => void;
  onCloseByDomain: (tabId: number, domain: string) => void;
  otherWindows: { windowId: number; tabCount: number; title: string }[];
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDragEnd?: () => void;
  index: number;
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

// Returns a color based on how stale a tab is
function ageColor(timestamp: number): string {
  const hours = (Date.now() - timestamp) / 3600000;
  if (hours < 1) return '#34D399';   // green - fresh
  if (hours < 6) return '#A7F3D0';   // light green
  if (hours < 24) return '#FBBF24';  // yellow - getting stale
  if (hours < 72) return '#FB923C';  // orange - stale
  return '#F87171';                   // red - very stale
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

export function TabCard({ tab, isSelected, isMultiSelected, isDuplicate, isBookmarked, mruPosition, query, note, onClick, onClose, onTogglePin, onToggleSelect, onToggleBookmark, onSaveNote, onSnooze, onMoveToWindow, onToggleMute, onCloseByDomain, otherWindows, onDragStart, onDragOver, onDragEnd, index, showUrl = true }: TabCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(note || '');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [snoozeMenu, setSnoozeMenu] = useState<{ x: number; y: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const domain = getDomain(tab.url);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Switch to tab', action: onClick },
    { label: tab.isPinned ? 'Unpin tab' : 'Pin tab', action: () => onTogglePin(tab.tabId, !tab.isPinned) },
    { label: isBookmarked ? 'Remove bookmark' : 'Bookmark tab', action: () => onToggleBookmark(tab.tabId) },
    { label: note ? 'Edit note' : 'Add note', action: () => { setEditingNote(true); setNoteText(note || ''); } },
    {
      label: 'Snooze tab',
      action: () => {
        setContextMenu(null);
        setSnoozeMenu(contextMenu ? { x: contextMenu.x + 10, y: contextMenu.y } : { x: 0, y: 0 });
      },
    },
    ...(otherWindows.length > 0
      ? [{
          label: 'Move to new window',
          action: () => onMoveToWindow(tab.tabId, -1),
          divider: true as const,
        }, ...otherWindows.map((w) => ({
          label: `Move to "${w.title.length > 25 ? w.title.slice(0, 25) + '...' : w.title}" (${w.tabCount} tabs)`,
          action: () => onMoveToWindow(tab.tabId, w.windowId),
        }))]
      : [{ label: 'Move to new window', action: () => onMoveToWindow(tab.tabId, -1), divider: true as const }]),
    ...(tab.isAudible ? [{ label: 'Mute tab', action: () => onToggleMute(tab.tabId) }] : []),
    { label: `Close all from ${domain}`, action: () => onCloseByDomain(tab.tabId, domain), divider: true },
    { label: 'Copy URL', action: () => navigator.clipboard.writeText(tab.url) },
    { label: 'Close tab', action: () => onClose(tab.tabId), danger: true, divider: true },
  ];

  useEffect(() => {
    if (editingNote) noteInputRef.current?.focus();
  }, [editingNote]);

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
        group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 cursor-pointer relative
        ${isMultiSelected
          ? 'bg-cyan-400/[0.12] border-l-2 border-l-cyan-400'
          : isSelected
            ? 'bg-white/[0.12] border-l-2 border-l-cyan-400'
            : 'hover:bg-white/[0.06] border-l-2 border-l-transparent'}
      `}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        onDragStart?.(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onMouseEnter={() => {
        hoverTimerRef.current = setTimeout(() => setShowPreview(true), 600);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setShowPreview(false);
      }}
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
              <span className="shrink-0 flex items-center gap-1 text-white/20">
                <span
                  className="w-1 h-1 rounded-full shrink-0"
                  style={{ backgroundColor: ageColor(tab.lastAccessed) }}
                  title={`Last accessed ${timeAgo(tab.lastAccessed)} ago`}
                />
                {timeAgo(tab.lastAccessed)}
              </span>
            )}
          </div>
        )}
        {/* Note display / editor */}
        {editingNote ? (
          <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={noteInputRef}
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  onSaveNote(tab.tabId, tab.url, noteText);
                  setEditingNote(false);
                }
                if (e.key === 'Escape') {
                  setNoteText(note || '');
                  setEditingNote(false);
                }
              }}
              placeholder="Add a note..."
              className="flex-1 bg-white/[0.06] rounded px-2 py-0.5 text-[11px] text-white/70 placeholder-white/25 outline-none border border-white/10 focus:border-cyan-400/40"
              maxLength={200}
            />
            <button
              onClick={() => { onSaveNote(tab.tabId, tab.url, noteText); setEditingNote(false); }}
              className="text-[10px] text-cyan-400/70 hover:text-cyan-400 px-1"
            >
              Save
            </button>
          </div>
        ) : note ? (
          <div
            className="mt-0.5 text-[11px] text-yellow-300/50 truncate cursor-pointer hover:text-yellow-300/70"
            onClick={(e) => { e.stopPropagation(); setEditingNote(true); }}
            title="Click to edit note"
          >
            {note}
          </div>
        ) : null}
      </div>

      {/* Action buttons (visible on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditingNote(true);
          setNoteText(note || '');
        }}
        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/15 transition-all ${
          note ? 'opacity-60 text-yellow-300' : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-yellow-300'
        }`}
        title={note ? 'Edit note' : 'Add note'}
      >
        <svg className="w-3 h-3" fill={note ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
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

      {/* Preview tooltip */}
      {showPreview && !contextMenu && !snoozeMenu && (
        <div
          className="absolute left-full ml-2 top-0 rounded-lg border border-white/[0.12] px-3 py-2 min-w-[280px] max-w-[360px] pointer-events-none"
          style={{
            zIndex: 2147483647,
            background: 'rgba(15, 15, 30, 0.97)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-[12px] text-white/80 font-medium truncate">{tab.title}</div>
          <div className="text-[10px] text-white/30 mt-1 break-all line-clamp-2">{tab.url}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/25">
            {tab.isPinned && <span>Pinned</span>}
            {tab.isDiscarded && <span>Suspended</span>}
            {tab.isAudible && <span>Playing audio</span>}
            {tab.groupTitle && <span>Group: {tab.groupTitle}</span>}
            <span>Window {tab.windowId}</span>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Snooze menu */}
      {snoozeMenu && (
        <SnoozeMenu
          x={snoozeMenu.x}
          y={snoozeMenu.y}
          onSnooze={(ms) => onSnooze(tab.tabId, ms)}
          onClose={() => setSnoozeMenu(null)}
        />
      )}
    </div>
  );
}
