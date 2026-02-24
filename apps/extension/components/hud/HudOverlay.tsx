import { useState, useEffect, useCallback } from 'react';
import { useHudState, loadHudData } from '@/lib/hooks/useHudState';
import { useTabActions } from '@/lib/hooks/useTabActions';
import { useKeyboardNav } from '@/lib/hooks/useKeyboardNav';
import { TabGrid } from './TabGrid';
import { BottomBar } from './BottomBar';
import { WindowStrip } from './WindowStrip';
import { WorkspaceSection } from './WorkspaceSection';
import { AnalyticsBar } from './AnalyticsBar';
import { CheatSheet } from './CheatSheet';
import { UndoToast } from './UndoToast';
import { CommandPalette, useCommands } from './CommandPalette';
import { searchHistory, type HistoryResult } from '@/lib/api-client';

export function HudOverlay() {
  const s = useHudState();
  const a = useTabActions(s);
  const [historyResults, setHistoryResults] = useState<HistoryResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Detect ai: prefix in query
  const isAiMode = s.query.startsWith('ai:');
  const aiQuery = isAiMode ? s.query.slice(3).trim() : '';

  // Debounced AI history search
  useEffect(() => {
    if (!isAiMode || !aiQuery) {
      setHistoryResults([]);
      return;
    }
    setAiLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchHistory(aiQuery, 15);
        setHistoryResults(results);
      } catch {
        setHistoryResults([]);
      } finally {
        setAiLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [isAiMode, aiQuery]);

  // Separate open tabs from history-only results
  const openUrls = new Set(s.tabs.map((t) => t.url));
  const historyOnly = historyResults.filter((r) => !openUrls.has(r.url));

  // Compute cols: prefer fewer, larger columns — matches Windows Task View feel
  const cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(s.displayTabs.length))));

  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      requestAnimationFrame(() => requestAnimationFrame(() => s.setAnimatingIn(true)));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useKeyboardNav(s, a, cols);

  useEffect(() => {
    s.setSelectedIndex(0);
  }, [s.query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for messages from background
  useEffect(() => {
    const listener = (message: { type: string; tabId?: number }) => {
      if (message.type === 'toggle-hud') {
        const now = Date.now();
        const timeSinceLastToggle = now - s.lastToggleRef.current;
        s.lastToggleRef.current = now;

        if (timeSinceLastToggle < 400) {
          chrome.runtime.sendMessage({ type: 'quick-switch' });
          return;
        }

        s.setVisible((prev) => {
          if (!prev) {
            s.fetchTabs();
            s.fetchRecentTabs();
            loadHudData(s);
            chrome.runtime.sendMessage({ type: 'get-all-thumbnails' }).then((res) => {
              if (res?.thumbnails) {
                s.setThumbnails(new Map(
                  Object.entries(res.thumbnails).map(([k, v]) => [Number(k), v as string])
                ));
              }
            }).catch(() => {});
            return true;
          }
          s.hide();
          return prev;
        });
      }

      if (message.type === 'tab-removed' && s.visible && message.tabId) {
        s.setTabs((prev) => prev.filter((t) => t.tabId !== message.tabId));
      }
      if (message.type === 'tab-created' && s.visible) {
        s.fetchTabs();
      }
      if (message.type === 'tabs-updated' && s.visible) {
        s.fetchTabs();
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  const commands = useCommands({
    closeDuplicates: a.closeDuplicates,
    closeSelectedTabs: a.closeSelectedTabs,
    groupSelectedTabs: a.groupSelectedTabs,
    ungroupSelectedTabs: a.ungroupSelectedTabs,
    reopenLastClosed: a.reopenLastClosed,
    toggleWindowFilter: () => s.setWindowFilter((p) => p === 'all' ? 'current' : 'all'),
    cycleSortMode: () => s.setSortMode((p) => p === 'mru' ? 'frecency' : p === 'frecency' ? 'domain' : p === 'domain' ? 'title' : 'mru'),
    selectAll: a.selectAll,
    openSettings: () => { chrome.runtime.openOptionsPage(); s.hide(); },
    openCheatSheet: () => s.setShowCheatSheet(true),
  });

  if (!s.visible) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 2147483647,
        backgroundColor: s.animatingIn ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        backdropFilter: s.animatingIn ? 'blur(20px) saturate(180%)' : 'blur(0px)',
        transition: 'background-color 180ms ease-out, backdrop-filter 180ms ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) s.hide(); }}
    >
      <div
        ref={panelRef}
        className="flex flex-col w-full h-full"
        style={{
          opacity: s.animatingIn ? 1 : 0,
          transform: s.animatingIn ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        }}
      >
        {/* Minimal header with analytics */}
        <div
          className="flex items-center gap-2 px-4 py-2 shrink-0"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/70" />
          <span className="text-[11px] font-semibold text-white/40 tracking-widest uppercase">TabFlow</span>
          <span className="text-[11px] text-white/20">·</span>
          <span className="text-[11px] text-white/30">{s.displayTabs.length} tabs</span>
          <div className="flex-1 flex justify-center">
            <AnalyticsBar />
          </div>
          <div className="text-[10px] text-white/20">ESC to close</div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0">
          {s.isCommandMode ? (
            <CommandPalette
              query={s.commandQuery}
              commands={commands}
              onClose={() => s.setQuery('')}
            />
          ) : (
            <TabGrid
              tabs={s.displayTabs}
              selectedIndex={s.selectedIndex}
              selectedTabs={s.selectedTabs}
              bookmarkedUrls={s.bookmarkedUrls}
              duplicateUrls={s.duplicateUrls}
              notesMap={s.notesMap}
              otherWindows={s.otherWindows.filter((w) => w.windowId !== s.currentWindowId)}
              actions={a}
              cols={cols}
              thumbnails={s.thumbnails}
            />
          )}

          {/* AI history results (closed tabs from Neon) */}
          {isAiMode && (historyResults.length > 0 || aiLoading) && (
            <div
              className="border-t border-white/[0.06] px-3 py-2 shrink-0"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-cyan-400/60 uppercase tracking-wider">
                  {aiLoading ? '⟳ Searching history…' : `✦ History (${historyResults.length})`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {historyOnly.slice(0, 6).map((r) => (
                  <button
                    key={r.url}
                    onClick={() => chrome.tabs.create({ url: r.url })}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-cyan-400/10 hover:border-cyan-400/20 transition-colors text-left"
                    title={r.url}
                  >
                    <span className="text-[11px] text-white/55 truncate max-w-[180px]">{r.title}</span>
                    <span className="text-[9px] text-white/20 shrink-0">↩ reopen</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Workspace sync */}
        <WorkspaceSection tabs={s.displayTabs} />

        {/* Window strip */}
        <WindowStrip
          windows={s.otherWindows}
          currentWindowId={s.currentWindowId}
        />

        {/* Search bar */}
        <BottomBar
          query={s.query}
          onQueryChange={s.setQuery}
          isAiMode={isAiMode}
        />
      </div>

      {s.showCheatSheet && (
        <CheatSheet onClose={() => s.setShowCheatSheet(false)} />
      )}

      {s.undoToast && (
        <UndoToast
          message={s.undoToast.message}
          onUndo={() => { a.reopenLastClosed(); s.setUndoToast(null); }}
          onDismiss={() => s.setUndoToast(null)}
        />
      )}
    </div>
  );
}
