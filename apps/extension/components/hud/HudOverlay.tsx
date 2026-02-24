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
import { searchHistory, checkHealth, type HistoryResult } from '@/lib/api-client';
import { getStoredTokens, type TokenSet } from '@/lib/auth';

export function HudOverlay() {
  const s = useHudState();
  const a = useTabActions(s);
  const [historyResults, setHistoryResults] = useState<HistoryResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [authUser, setAuthUser] = useState<TokenSet | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
            checkHealth().then(setBackendOnline);
            getStoredTokens().then(setAuthUser);
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
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        zIndex: 2147483647,
        backgroundColor: s.animatingIn ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        backdropFilter: s.animatingIn ? 'blur(24px) saturate(180%)' : 'blur(0px)',
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
        {/* Centered card container */}
        <div className="flex-1 flex items-center justify-center min-h-0 px-8 py-6">
          <div
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(18, 18, 30, 0.82)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
              maxWidth: 1300,
              maxHeight: '75vh',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimal header inside the container */}
            <div className="flex items-center gap-3 px-4 py-2 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-[11px] font-medium text-white/30 tracking-wider uppercase">TabFlow</span>
              <span className="text-[11px] text-white/15">{s.displayTabs.length} tabs</span>

              <div className="flex-1 flex justify-center">
                <AnalyticsBar />
              </div>

              {/* Auth */}
              {authUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/25">{authUser.email}</span>
                  <button
                    onClick={async () => {
                      await chrome.runtime.sendMessage({ type: 'sign-out' });
                      setAuthUser(null);
                    }}
                    className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {authError && (
                    <span className="text-[9px] text-red-400/60 max-w-[140px] truncate" title={authError}>
                      {authError}
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      setAuthLoading(true);
                      setAuthError(null);
                      try {
                        const res = await chrome.runtime.sendMessage({ type: 'sign-in' });
                        if (res?.success) {
                          setAuthUser(res.tokenSet);
                        } else {
                          setAuthError(res?.error || 'Sign-in failed');
                        }
                      } catch (e: any) {
                        setAuthError(e?.message || 'Sign-in failed');
                      } finally {
                        setAuthLoading(false);
                      }
                    }}
                    disabled={authLoading}
                    className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/30 hover:bg-white/[0.06] hover:text-white/50 disabled:opacity-40 transition-colors"
                  >
                    {authLoading ? '...' : 'Sign in'}
                  </button>
                </div>
              )}
            </div>

            {/* Tab grid */}
            <div className="flex-1 min-h-0 overflow-hidden">
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
            </div>

            {/* AI history results (closed tabs from Neon) */}
            {isAiMode && (historyResults.length > 0 || aiLoading) && (
              <div
                className="px-3 py-2 shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">
                    {aiLoading ? 'Searching history...' : `History (${historyResults.length})`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {historyOnly.slice(0, 6).map((r) => (
                    <button
                      key={r.url}
                      onClick={() => chrome.tabs.create({ url: r.url })}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors text-left"
                      title={r.url}
                    >
                      <span className="text-[11px] text-white/50 truncate max-w-[180px]">{r.title}</span>
                      <span className="text-[9px] text-white/20 shrink-0">reopen</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom section: workspaces + search — pinned to bottom */}
        <div className="shrink-0">
          <WorkspaceSection tabs={s.displayTabs} />

          <WindowStrip
            windows={s.otherWindows}
            currentWindowId={s.currentWindowId}
          />

          <BottomBar
            query={s.query}
            onQueryChange={s.setQuery}
            isAiMode={isAiMode}
          />
        </div>
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
