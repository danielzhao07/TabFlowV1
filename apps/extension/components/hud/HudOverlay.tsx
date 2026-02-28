import { useState, useEffect, useCallback } from 'react';
import { useHudState, loadHudData } from '@/lib/hooks/useHudState';
import { useTabActions } from '@/lib/hooks/useTabActions';
import { useKeyboardNav } from '@/lib/hooks/useKeyboardNav';
import { saveSettings } from '@/lib/settings';
import type { TabFlowSettings } from '@/lib/settings';
import { TabGrid } from './TabGrid';
import { BottomBar } from './BottomBar';
import { WindowStrip } from './WindowStrip';
import { WorkspaceSection } from './WorkspaceSection';
import { AnalyticsBar } from './AnalyticsBar';
import { CheatSheet } from './CheatSheet';
import { UndoToast } from './UndoToast';
import { CommandPalette, useCommands } from './CommandPalette';
import { GroupSuggestions } from './GroupSuggestions';
import { SettingsPanel } from './SettingsPanel';
import { searchHistory, checkHealth, type HistoryResult } from '@/lib/api-client';
import { getStoredTokens, type TokenSet } from '@/lib/auth';

export function HudOverlay() {
  const s = useHudState();
  const a = useTabActions(s);
  const [historyResults, setHistoryResults] = useState<HistoryResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [authUser, setAuthUser] = useState<TokenSet | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Detect ai: prefix in query
  const isAiMode = s.query.startsWith('ai:');
  const aiQuery = isAiMode ? s.query.slice(3).trim() : '';

  // Debounced AI history search
  useEffect(() => {
    if (!isAiMode || !aiQuery) {
      setHistoryResults([]);
      setAiError(false);
      return;
    }
    setAiLoading(true);
    setAiError(false);
    const timer = setTimeout(async () => {
      try {
        const results = await searchHistory(aiQuery, 15);
        setHistoryResults(results);
      } catch {
        setHistoryResults([]);
        setAiError(true);
      } finally {
        setAiLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [isAiMode, aiQuery]);

  // Separate open tabs from history-only results
  const openUrls = new Set(s.tabs.map((t) => t.url));
  const historyOnly = historyResults.filter((r) => !openUrls.has(r.url));

  // Compute cols: must match TabGrid's internal formula exactly for keyboard nav to be in sync
  const N = s.displayTabs.length;
  const COLS_LOOKUP = [0, 1, 2, 3, 2, 3, 3, 4, 4, 3, 5, 4, 4];
  const cols = Math.max(1, Math.min(N, N <= 12
    ? (COLS_LOOKUP[N] ?? Math.ceil(Math.sqrt(N)))
    : Math.min(6, Math.ceil(Math.sqrt(N)))));

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
            checkHealth().catch(() => {});
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

  const handleSettingChange = useCallback(async (patch: Partial<TabFlowSettings>) => {
    const updated = await saveSettings(patch);
    s.setSettings(updated);
  }, [s]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.visible) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 2147483647,
        backgroundColor: s.animatingIn ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
        backdropFilter: s.animatingIn ? 'blur(28px) saturate(180%)' : 'blur(0px)',
        transition: 'background-color 180ms ease-out, backdrop-filter 180ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSettings(false);
          s.hide();
        }
      }}
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
        {/* Top-left: logo + tab count + analytics */}
        <div className="absolute top-4 left-4 flex items-center gap-3" style={{ zIndex: 2147483646 }}>
          <span className="text-[11px] font-semibold text-white/40 tracking-wider uppercase">TabFlow</span>
          <span
            className="text-[10px] text-white/20 px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            {s.displayTabs.length}
          </span>
          {!s.settings?.hideTodayTabs && <AnalyticsBar tabs={s.tabs} onSwitch={s.hide} />}
        </div>

        {/* Floating gear button — top-right */}
        <div className="absolute top-4 right-4" style={{ zIndex: 2147483646 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings((p) => !p); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{
              background: showSettings ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: showSettings ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
            }}
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            authUser={authUser}
            authLoading={authLoading}
            authError={authError}
            onSignIn={async () => {
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
            onSignOut={async () => {
              await chrome.runtime.sendMessage({ type: 'sign-out' });
              setAuthUser(null);
            }}
            settings={s.settings}
            onSettingChange={handleSettingChange}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Tab grid — floats directly on backdrop */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 pt-4 pb-2">
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
              actions={a}
              cols={cols}
              thumbnails={s.thumbnails}
            />
          )}
        </div>

        {/* AI history results (closed tabs from Neon) */}
        {isAiMode && aiQuery && (
          <div
            className="px-6 py-2 shrink-0 mx-6 mb-1 rounded-xl"
            style={{ background: 'rgba(18,18,30,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                {aiLoading ? 'Searching history…' : aiError ? 'API offline — start the API server to enable semantic search' : historyOnly.length > 0 ? `History (${historyOnly.length})` : 'No history found — browse more to build your search index'}
              </span>
            </div>
            {!aiLoading && !aiError && historyOnly.length > 0 && (
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
            )}
          </div>
        )}

        {/* Bottom section: workspaces + search — pinned to bottom */}
        <div className="shrink-0">
          <GroupSuggestions
            tabs={s.tabs}
            actions={a}
            selectedTabs={s.selectedTabs}
            groupFilter={s.groupFilter}
            onGroupFilterToggle={(gid) => s.setGroupFilter((prev) => {
              const next = new Set(prev);
              if (next.has(gid)) next.delete(gid);
              else next.add(gid);
              return next;
            })}
          />
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
