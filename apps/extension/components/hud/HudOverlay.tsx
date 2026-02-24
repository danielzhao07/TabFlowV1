import { useState, useEffect, useCallback } from 'react';
import { useHudState, loadHudData } from '@/lib/hooks/useHudState';
import { useTabActions } from '@/lib/hooks/useTabActions';
import { useKeyboardNav } from '@/lib/hooks/useKeyboardNav';
import { TabGrid } from './TabGrid';
import { BottomBar } from './BottomBar';
import { CheatSheet } from './CheatSheet';
import { UndoToast } from './UndoToast';
import { CommandPalette, useCommands } from './CommandPalette';
import { RecentlyClosedSection } from './RecentlyClosedSection';
import { SnoozedSection } from './SnoozedSection';

export function HudOverlay() {
  const s = useHudState();
  const a = useTabActions(s);
  const [cols, setCols] = useState(4);

  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      requestAnimationFrame(() => requestAnimationFrame(() => s.setAnimatingIn(true)));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useKeyboardNav(s, a, cols);

  useEffect(() => {
    s.setSelectedIndex(0);
  }, [s.query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for toggle messages from background
  useEffect(() => {
    const listener = (message: { type: string }) => {
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
        backgroundColor: s.animatingIn ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
        backdropFilter: s.animatingIn ? 'blur(8px)' : 'blur(0px)',
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
        {/* Top header */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] shrink-0"
          style={{ background: 'rgba(8,8,20,0.9)' }}
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-[13px] font-semibold text-white/60 tracking-widest uppercase">TabFlow</span>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-white/20">
            {s.isAiMode && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400/70 border border-cyan-500/20">
                {s.aiLoading ? '⟳ AI searching…' : '✦ AI results'}
              </span>
            )}
            <span>Ctrl+S sort · Ctrl+F window · Alt+Q close</span>
          </div>
        </div>

        {/* Main content */}
        <div
          className="flex-1 flex flex-col min-h-0"
          style={{ background: 'rgba(10,10,22,0.92)', backdropFilter: 'blur(20px) saturate(160%)' }}
        >
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
              onColsChange={setCols}
              thumbnails={s.thumbnails}
            />
          )}

          <SnoozedSection onWake={s.fetchTabs} />
          <RecentlyClosedSection recentTabs={s.recentTabs} onRestore={a.restoreSession} />
        </div>

        {/* Bottom search bar */}
        <BottomBar
          query={s.query}
          onQueryChange={s.setQuery}
          tabCount={s.displayTabs.length}
          totalCount={s.tabs.length}
          selectedCount={s.selectedTabs.size}
          duplicateCount={s.duplicateCount}
          windowFilter={s.windowFilter}
          onWindowFilterChange={s.setWindowFilter}
          sortMode={s.sortMode}
          onSortModeChange={s.setSortMode}
          onCloseSelected={a.closeSelectedTabs}
          onCloseDuplicates={a.closeDuplicates}
          tabs={s.tabs}
          onGroupSuggestion={a.groupSuggestionTabs}
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
