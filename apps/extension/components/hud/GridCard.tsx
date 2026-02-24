import { useState, useRef } from 'react';
import type { TabInfo } from '@/lib/types';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { SnoozeMenu } from './SnoozeMenu';

const GROUP_COLORS: Record<string, string> = {
  blue: '#3b82f6', cyan: '#06b6d4', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', red: '#ef4444', pink: '#ec4899', purple: '#a855f7',
  grey: '#6b7280',
};

interface GridCardProps {
  tab: TabInfo;
  index: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isBookmarked: boolean;
  isDuplicate: boolean;
  note?: string;
  thumbnail?: string;
  onSwitch: (tabId: number) => void;
  onClose: (tabId: number) => void;
  onTogglePin: (tabId: number, pinned: boolean) => void;
  onToggleSelect: (tabId: number, shiftKey: boolean) => void;
  onToggleBookmark: (tabId: number) => void;
  onSnooze: (tabId: number, durationMs: number) => void;
  onMoveToWindow: (tabId: number, windowId: number) => void;
  onToggleMute: (tabId: number) => void;
  otherWindows: { windowId: number; tabCount: number; title: string }[];
  animDelay?: number;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

function domainColor(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 50%, 55%)`;
}

export function GridCard({
  tab, index, isSelected, isMultiSelected, isBookmarked, isDuplicate, note, thumbnail,
  onSwitch, onClose, onTogglePin, onToggleSelect, onToggleBookmark,
  onSnooze, onMoveToWindow, onToggleMute, otherWindows, animDelay = 0,
}: GridCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [snoozeMenu, setSnoozeMenu] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const domain = getDomain(tab.url);
  const color = domainColor(domain);
  const groupColor = tab.groupColor ? (GROUP_COLORS[tab.groupColor] ?? '#6b7280') : null;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onToggleSelect(tab.tabId, false);
    } else if (e.shiftKey) {
      onToggleSelect(tab.tabId, true);
    } else {
      onSwitch(tab.tabId);
    }
  };

  const contextItems: ContextMenuItem[] = [
    {
      label: 'Switch to tab',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
      action: () => onSwitch(tab.tabId),
    },
    {
      label: tab.isPinned ? 'Unpin tab' : 'Pin tab',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>,
      action: () => onTogglePin(tab.tabId, !tab.isPinned),
    },
    {
      label: isBookmarked ? 'Remove bookmark' : 'Bookmark tab',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
      action: () => onToggleBookmark(tab.tabId),
    },
    {
      label: tab.isAudible ? 'Unmute tab' : 'Mute tab',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" /></svg>,
      action: () => onToggleMute(tab.tabId),
    },
    {
      label: 'Snooze tab',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      action: () => {
        const rect = cardRef.current?.getBoundingClientRect();
        setSnoozeMenu({ x: rect ? rect.left : 0, y: rect ? rect.bottom : 0 });
      },
    },
    {
      label: 'Copy URL',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      action: () => navigator.clipboard.writeText(tab.url),
    },
    ...otherWindows.map((w) => ({
      label: `Move to: ${w.title.slice(0, 20)}`,
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
      action: () => onMoveToWindow(tab.tabId, w.windowId),
    })),
    {
      label: 'Move to new window',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
      action: () => onMoveToWindow(tab.tabId, -1),
    },
    {
      label: 'Close tab',
      icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      action: () => onClose(tab.tabId),
      danger: true,
      divider: true,
    },
  ];

  const borderColor = isSelected
    ? 'rgba(255,255,255,0.7)'
    : isMultiSelected
    ? 'rgba(255,255,255,0.35)'
    : 'rgba(255,255,255,0.06)';

  return (
    <>
      <div
        ref={cardRef}
        className="h-full flex flex-col rounded-xl overflow-hidden cursor-pointer select-none"
        style={{
          animationName: 'cardIn',
          animationDuration: '200ms',
          animationDelay: `${animDelay}ms`,
          animationFillMode: 'both',
          animationTimingFunction: 'cubic-bezier(0.16,1,0.3,1)',
          background: 'rgba(15,15,28,0.92)',
          border: `1.5px solid ${borderColor}`,
          boxShadow: isSelected
            ? `0 0 0 1px rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.5)`
            : '0 2px 12px rgba(0,0,0,0.3)',
          transition: 'border-color 120ms, box-shadow 120ms, transform 120ms',
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)';
          if (!isSelected && !isMultiSelected) {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.18)';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLDivElement).style.borderColor = borderColor;
        }}
      >
        {/* Title bar at top — matches Windows Task View style */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 shrink-0"
          style={{ background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Group color dot */}
          {groupColor && (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: groupColor }} />
          )}

          {/* Favicon */}
          {tab.faviconUrl && !faviconError ? (
            <img
              src={tab.faviconUrl}
              alt=""
              className="w-4 h-4 rounded-sm shrink-0"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div
              className="w-4 h-4 rounded-sm shrink-0 flex items-center justify-center text-[9px] font-bold"
              style={{ backgroundColor: color + '35', color }}
            >
              {(tab.title || domain).charAt(0).toUpperCase()}
            </div>
          )}

          {/* Title */}
          <span className="flex-1 text-[12px] text-white/80 truncate font-medium leading-none">
            {tab.title || domain}
          </span>

          {/* Status icons */}
          {tab.isPinned && <span className="text-[10px] text-amber-400/60 shrink-0">📌</span>}
          {tab.isAudible && <span className="text-[10px] text-green-400/70 shrink-0">♪</span>}
          {isBookmarked && <span className="text-[10px] text-amber-400/60 shrink-0">★</span>}

          {/* Close button */}
          <button
            className="w-4 h-4 rounded flex items-center justify-center text-white/25 hover:text-white hover:bg-red-500/80 transition-colors shrink-0"
            onClick={(e) => { e.stopPropagation(); onClose(tab.tabId); }}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Screenshot / Fallback — fills remaining card height */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{
                background: `radial-gradient(ellipse at 50% 40%, ${color}22 0%, transparent 70%)`,
                backgroundColor: 'rgba(0,0,0,0.15)',
              }}
            >
              {tab.faviconUrl && !faviconError ? (
                <img
                  src={tab.faviconUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl opacity-55"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: color + '28', color }}
                >
                  {(tab.title || domain).charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] text-white/25 truncate px-3 max-w-full">{domain}</span>
            </div>
          )}

          {/* Duplicate badge */}
          {isDuplicate && (
            <div className="absolute top-1.5 left-1.5">
              <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 text-[9px] text-amber-400">DUP</span>
            </div>
          )}

          {/* Note indicator */}
          {note && (
            <div className="absolute bottom-1.5 left-1.5 right-1.5">
              <div className="text-[10px] text-cyan-400/50 truncate italic">{note}</div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {snoozeMenu && (
        <SnoozeMenu
          x={snoozeMenu.x}
          y={snoozeMenu.y}
          onSnooze={(ms) => onSnooze(tab.tabId, ms)}
          onClose={() => setSnoozeMenu(null)}
        />
      )}
    </>
  );
}
