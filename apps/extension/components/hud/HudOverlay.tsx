import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { TabInfo, RecentTab } from '@/lib/types';
import { searchTabs } from '@/lib/fuse-search';
import { getSettings, type TabFlowSettings } from '@/lib/settings';
import { getFrecencyMap, computeScore } from '@/lib/frecency';
import type { TabBookmark } from '@/lib/bookmarks';
import { SearchBar } from './SearchBar';
import { TabList } from './TabList';
import { StatusBar } from './StatusBar';
import { RecentlyClosedSection } from './RecentlyClosedSection';
import { GroupSuggestions } from './GroupSuggestions';
import { CheatSheet } from './CheatSheet';
import { UndoToast } from './UndoToast';
import { CommandPalette, useCommands } from './CommandPalette';
import { SnoozedSection } from './SnoozedSection';

export function HudOverlay() {
  const [visible, setVisible] = useState(false);
  const [animatingIn, setAnimatingIn] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settings, setSettings] = useState<TabFlowSettings | null>(null);
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number | undefined>();
  const [windowFilter, setWindowFilter] = useState<'all' | 'current'>('all');
  const [selectedTabs, setSelectedTabs] = useState<Set<number>>(new Set());
  const [sortMode, setSortMode] = useState<'mru' | 'domain' | 'title' | 'frecency'>('mru');
  const [frecencyScores, setFrecencyScores] = useState<Map<string, number>>(new Map());
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set());
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [undoToast, setUndoToast] = useState<{ message: string; tabTitle: string } | null>(null);
  const [otherWindows, setOtherWindows] = useState<{ windowId: number; tabCount: number; title: string }[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastToggleRef = useRef<number>(0);

  const windowFilteredTabs = windowFilter === 'current' && currentWindowId
    ? tabs.filter((t) => t.windowId === currentWindowId)
    : tabs;

  const sortedTabs = useMemo(() => {
    const list = [...windowFilteredTabs];
    if (sortMode === 'domain') {
      list.sort((a, b) => {
        const da = getDomainFromUrl(a.url);
        const db = getDomainFromUrl(b.url);
        return da.localeCompare(db) || a.title.localeCompare(b.title);
      });
    } else if (sortMode === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === 'frecency') {
      list.sort((a, b) => {
        const sa = frecencyScores.get(a.url) || 0;
        const sb = frecencyScores.get(b.url) || 0;
        return sb - sa;
      });
    }
    return list;
  }, [windowFilteredTabs, sortMode, frecencyScores]);

  // Duplicate detection: map URL -> array of tabIds (moved above filteredTabs for search filter)
  const duplicateMap = new Map<string, number[]>();
  for (const tab of tabs) {
    if (!tab.url || tab.url === 'chrome://newtab/') continue;
    const existing = duplicateMap.get(tab.url);
    if (existing) existing.push(tab.tabId);
    else duplicateMap.set(tab.url, [tab.tabId]);
  }
  const duplicateUrls = new Set<string>();
  const duplicateCount = { total: 0 };
  for (const [url, ids] of duplicateMap) {
    if (ids.length > 1) {
      duplicateUrls.add(url);
      duplicateCount.total += ids.length - 1; // extra copies
    }
  }

  const filteredTabs = query && !query.startsWith('>')
    ? searchTabs(sortedTabs, query, settings?.searchThreshold, notesMap.size > 0 ? notesMap : undefined, duplicateUrls)
    : sortedTabs;

  const displayTabs = settings?.maxResults
    ? filteredTabs.slice(0, settings.maxResults)
    : filteredTabs;

  const fetchTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'get-tabs' });
    if (response?.tabs) {
      setTabs(response.tabs);
    }
    if (response?.currentWindowId) {
      setCurrentWindowId(response.currentWindowId);
    }
  }, []);

  const hide = useCallback(() => {
    setAnimatingIn(false);
    setShowCheatSheet(false);
    setTimeout(() => {
      setVisible(false);
      setQuery('');
      setSelectedIndex(0);
      setSelectedTabs(new Set());
    }, 150);
  }, []);

  const switchToTab = useCallback(
    (tabId: number) => {
      chrome.runtime.sendMessage({ type: 'switch-tab', payload: { tabId } });
      hide();
    },
    [hide],
  );

  const closeTab = useCallback((tabId: number) => {
    const closedTab = tabs.find((t) => t.tabId === tabId);
    chrome.runtime.sendMessage({ type: 'close-tab', payload: { tabId } });
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.tabId !== tabId);
      setSelectedIndex((idx) => Math.min(idx, Math.max(0, newTabs.length - 1)));
      return newTabs;
    });
    if (closedTab) {
      const title = closedTab.title.length > 30 ? closedTab.title.slice(0, 30) + '...' : closedTab.title;
      setUndoToast({ message: `Closed "${title}"`, tabTitle: closedTab.title });
    }
  }, [tabs]);

  const togglePin = useCallback((tabId: number, pinned: boolean) => {
    chrome.runtime.sendMessage({ type: 'pin-tab', payload: { tabId, pinned } });
    setTabs((prev) => prev.map((t) => t.tabId === tabId ? { ...t, isPinned: pinned } : t));
  }, []);

  const toggleSelect = useCallback((tabId: number, shiftKey: boolean) => {
    setSelectedTabs((prev) => {
      const next = new Set(prev);
      if (shiftKey && prev.size > 0) {
        const lastSelected = [...prev].pop()!;
        const lastIdx = displayTabs.findIndex((t) => t.tabId === lastSelected);
        const curIdx = displayTabs.findIndex((t) => t.tabId === tabId);
        if (lastIdx !== -1 && curIdx !== -1) {
          const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
          for (let i = start; i <= end; i++) {
            next.add(displayTabs[i].tabId);
          }
        }
      } else {
        if (next.has(tabId)) next.delete(tabId);
        else next.add(tabId);
      }
      return next;
    });
  }, [displayTabs]);

  const closeSelectedTabs = useCallback(() => {
    for (const tabId of selectedTabs) {
      chrome.runtime.sendMessage({ type: 'close-tab', payload: { tabId } });
    }
    setTabs((prev) => {
      const newTabs = prev.filter((t) => !selectedTabs.has(t.tabId));
      setSelectedIndex((idx) => Math.min(idx, Math.max(0, newTabs.length - 1)));
      return newTabs;
    });
    setSelectedTabs(new Set());
  }, [selectedTabs]);

  const closeDuplicates = useCallback(() => {
    const toClose: number[] = [];
    for (const [, ids] of duplicateMap) {
      if (ids.length > 1) {
        toClose.push(...ids.slice(1));
      }
    }
    for (const tabId of toClose) {
      chrome.runtime.sendMessage({ type: 'close-tab', payload: { tabId } });
    }
    setTabs((prev) => {
      const closeSet = new Set(toClose);
      const newTabs = prev.filter((t) => !closeSet.has(t.tabId));
      setSelectedIndex((idx) => Math.min(idx, Math.max(0, newTabs.length - 1)));
      return newTabs;
    });
  }, [duplicateMap]);

  const groupSelectedTabs = useCallback(async () => {
    const tabIds = selectedTabs.size > 0
      ? [...selectedTabs]
      : displayTabs[selectedIndex] ? [displayTabs[selectedIndex].tabId] : [];
    if (tabIds.length === 0) return;
    // Auto-detect a group name from the most common domain
    const domains = tabIds.map((id) => {
      const tab = tabs.find((t) => t.tabId === id);
      return tab ? getDomainFromUrl(tab.url) : '';
    });
    const domainCounts = new Map<string, number>();
    for (const d of domains) {
      domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
    }
    let topDomain = '';
    let topCount = 0;
    for (const [d, c] of domainCounts) {
      if (c > topCount) { topDomain = d; topCount = c; }
    }
    const title = topDomain.split('.')[0] || '';
    await chrome.runtime.sendMessage({ type: 'group-tabs', payload: { tabIds, title } });
    setSelectedTabs(new Set());
    fetchTabs();
  }, [selectedTabs, displayTabs, selectedIndex, tabs, fetchTabs]);

  const ungroupSelectedTabs = useCallback(async () => {
    const tabIds = selectedTabs.size > 0
      ? [...selectedTabs]
      : displayTabs[selectedIndex] ? [displayTabs[selectedIndex].tabId] : [];
    if (tabIds.length === 0) return;
    await chrome.runtime.sendMessage({ type: 'ungroup-tabs', payload: { tabIds } });
    setSelectedTabs(new Set());
    fetchTabs();
  }, [selectedTabs, displayTabs, selectedIndex, fetchTabs]);

  const toggleBookmark = useCallback(async (tabId: number) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) return;
    if (bookmarkedUrls.has(tab.url)) {
      const response = await chrome.runtime.sendMessage({ type: 'remove-bookmark', payload: { url: tab.url } });
      if (response?.bookmarks) {
        setBookmarkedUrls(new Set(response.bookmarks.map((b: TabBookmark) => b.url)));
      }
    } else {
      const response = await chrome.runtime.sendMessage({
        type: 'add-bookmark',
        payload: { url: tab.url, title: tab.title, faviconUrl: tab.faviconUrl },
      });
      if (response?.bookmarks) {
        setBookmarkedUrls(new Set(response.bookmarks.map((b: TabBookmark) => b.url)));
      }
    }
  }, [tabs, bookmarkedUrls]);

  const saveNote = useCallback(async (_tabId: number, url: string, note: string) => {
    await chrome.runtime.sendMessage({ type: 'save-note', payload: { url, note } });
    setNotesMap((prev) => {
      const next = new Map(prev);
      if (note.trim()) next.set(url, note.trim());
      else next.delete(url);
      return next;
    });
  }, []);

  const snoozeTab = useCallback(async (tabId: number, durationMs: number) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) return;
    await chrome.runtime.sendMessage({
      type: 'snooze-tab',
      payload: { tabId, url: tab.url, title: tab.title, faviconUrl: tab.faviconUrl, durationMs },
    });
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.tabId !== tabId);
      setSelectedIndex((idx) => Math.min(idx, Math.max(0, newTabs.length - 1)));
      return newTabs;
    });
    const title = tab.title.length > 30 ? tab.title.slice(0, 30) + '...' : tab.title;
    setUndoToast({ message: `Snoozed "${title}"`, tabTitle: tab.title });
  }, [tabs]);

  const moveToWindow = useCallback(async (tabId: number, windowId: number) => {
    await chrome.runtime.sendMessage({ type: 'move-to-window', payload: { tabId, windowId } });
    fetchTabs();
    // Refresh window list
    chrome.runtime.sendMessage({ type: 'get-windows' }).then((response) => {
      if (response?.windows) {
        setOtherWindows(response.windows.filter((w: any) => w.windowId !== currentWindowId));
      }
    });
  }, [fetchTabs, currentWindowId]);

  const reorderTabs = useCallback(async (fromIndex: number, toIndex: number) => {
    const tab = displayTabs[fromIndex];
    if (!tab) return;
    // Calculate the target position based on the toIndex tab
    const targetTab = displayTabs[toIndex];
    if (!targetTab) return;
    try {
      // Move tab in Chrome to be adjacent to the target
      await chrome.tabs.move(tab.tabId, { index: toIndex > fromIndex ? toIndex : toIndex });
      fetchTabs();
    } catch {
      // Tab may have been closed
    }
  }, [displayTabs, fetchTabs]);

  const toggleMute = useCallback(async (tabId: number) => {
    const tab = tabs.find((t) => t.tabId === tabId);
    if (!tab) return;
    await chrome.runtime.sendMessage({ type: 'mute-tab', payload: { tabId, muted: !tab.isAudible } });
    fetchTabs();
  }, [tabs, fetchTabs]);

  const closeByDomain = useCallback(async (tabId: number, domain: string) => {
    await chrome.runtime.sendMessage({ type: 'close-by-domain', payload: { domain, excludeTabId: tabId } });
    fetchTabs();
  }, [fetchTabs]);

  const groupSuggestionTabs = useCallback(async (tabIds: number[], domain: string) => {
    const title = domain.split('.')[0] || domain;
    await chrome.runtime.sendMessage({ type: 'group-tabs', payload: { tabIds, title } });
    fetchTabs();
  }, [fetchTabs]);

  const fetchRecentTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'get-recent' });
    if (response?.recentTabs) {
      setRecentTabs(response.recentTabs);
    }
  }, []);

  const restoreSession = useCallback(async (sessionId: string) => {
    await chrome.runtime.sendMessage({ type: 'restore-session', payload: { sessionId } });
    fetchTabs();
    fetchRecentTabs();
  }, [fetchTabs, fetchRecentTabs]);

  const reopenLastClosed = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'reopen-last-closed' });
    if (response?.success) {
      fetchTabs();
      fetchRecentTabs();
    }
  }, [fetchTabs, fetchRecentTabs]);

  const isCommandMode = query.startsWith('>');
  const commandQuery = isCommandMode ? query.slice(1).trim() : '';

  const commands = useCommands({
    closeDuplicates,
    closeSelectedTabs,
    groupSelectedTabs,
    ungroupSelectedTabs,
    reopenLastClosed,
    toggleWindowFilter: () => setWindowFilter((prev) => prev === 'all' ? 'current' : 'all'),
    cycleSortMode: () => setSortMode((prev) => {
      if (prev === 'mru') return 'frecency';
      if (prev === 'frecency') return 'domain';
      if (prev === 'domain') return 'title';
      return 'mru';
    }),
    selectAll: () => {
      const allIds = new Set(displayTabs.map((t) => t.tabId));
      setSelectedTabs((prev) => {
        if (displayTabs.every((t) => prev.has(t.tabId))) return new Set();
        return allIds;
      });
    },
    openSettings: () => { chrome.runtime.openOptionsPage(); hide(); },
    openCheatSheet: () => setShowCheatSheet(true),
  });

  // Listen for toggle messages from background
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'toggle-hud') {
        const now = Date.now();
        const timeSinceLastToggle = now - lastToggleRef.current;
        lastToggleRef.current = now;

        // Double-tap Alt+Q (within 400ms): quick-switch to previous tab
        if (timeSinceLastToggle < 400) {
          chrome.runtime.sendMessage({ type: 'quick-switch' });
          return;
        }

        setVisible((prev) => {
          if (!prev) {
            fetchTabs();
            fetchRecentTabs();
            getSettings().then(setSettings);
            getFrecencyMap().then((map) => {
              const scores = new Map<string, number>();
              for (const [url, entry] of map) {
                scores.set(url, computeScore(entry));
              }
              setFrecencyScores(scores);
            });
            chrome.runtime.sendMessage({ type: 'get-bookmarks' }).then((response) => {
              if (response?.bookmarks) {
                setBookmarkedUrls(new Set(response.bookmarks.map((b: TabBookmark) => b.url)));
              }
            });
            chrome.runtime.sendMessage({ type: 'get-notes' }).then((response) => {
              if (response?.notes) {
                setNotesMap(new Map(Object.entries(response.notes)));
              }
            });
            chrome.runtime.sendMessage({ type: 'get-windows' }).then((response) => {
              if (response?.windows) {
                const senderWindowId = response.windows.find?.((w: any) => w.windowId);
                setOtherWindows(response.windows);
              }
            });
            return true;
          }
          hide();
          return prev;
        });
      }
      if (message.type === 'tabs-updated' && visible) {
        fetchTabs();
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [fetchTabs, fetchRecentTabs, visible, hide]);

  // Trigger enter animation after visible changes
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimatingIn(true));
      });
    }
  }, [visible]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+X: close all multi-selected tabs
      if (e.key === 'X' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (selectedTabs.size > 0) {
          closeSelectedTabs();
        }
        return;
      }

      // Ctrl+X: close selected tab
      if (e.key === 'x' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (displayTabs[selectedIndex]) {
          closeTab(displayTabs[selectedIndex].tabId);
        }
        return;
      }

      // Ctrl+Shift+T: reopen last closed tab
      if (e.key === 'T' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        reopenLastClosed();
        return;
      }

      // Ctrl+F: toggle window filter
      if (e.key === 'f' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setWindowFilter((prev) => prev === 'all' ? 'current' : 'all');
        return;
      }

      // Ctrl+G: group selected tabs
      if (e.key === 'g' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        groupSelectedTabs();
        return;
      }

      // Ctrl+Shift+G: ungroup selected tabs
      if (e.key === 'G' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        ungroupSelectedTabs();
        return;
      }

      // Ctrl+B: bookmark/unbookmark current tab
      if (e.key === 'b' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (displayTabs[selectedIndex]) {
          toggleBookmark(displayTabs[selectedIndex].tabId);
        }
        return;
      }

      // Ctrl+M: mute/unmute current tab
      if (e.key === 'm' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (displayTabs[selectedIndex]) {
          toggleMute(displayTabs[selectedIndex].tabId);
        }
        return;
      }

      // Ctrl+S: cycle sort mode
      if (e.key === 's' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setSortMode((prev) => {
          if (prev === 'mru') return 'frecency';
          if (prev === 'frecency') return 'domain';
          if (prev === 'domain') return 'title';
          return 'mru';
        });
        return;
      }

      // Ctrl+A: select all visible tabs
      if (e.key === 'a' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const allIds = new Set(displayTabs.map((t) => t.tabId));
        setSelectedTabs((prev) => {
          // If all already selected, deselect all
          if (displayTabs.every((t) => prev.has(t.tabId))) {
            return new Set();
          }
          return allIds;
        });
        return;
      }

      // ?: toggle cheat sheet (only when not typing in search)
      const isTyping = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (!isTyping && e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setShowCheatSheet((prev) => !prev);
        return;
      }

      // Number keys 1-9: quick-switch (only when not typing in search)
      if (!isTyping && !e.ctrlKey && !e.altKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (displayTabs[index]) {
          e.preventDefault();
          switchToTab(displayTabs[index].tabId);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, displayTabs.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayTabs[selectedIndex]) {
            switchToTab(displayTabs[selectedIndex].tabId);
          }
          break;
        case 'Escape':
          e.preventDefault();
          hide();
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
          } else {
            setSelectedIndex((prev) => Math.min(prev + 1, displayTabs.length - 1));
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, displayTabs, selectedIndex, switchToTab, closeTab, reopenLastClosed, hide, selectedTabs, closeSelectedTabs, groupSelectedTabs, ungroupSelectedTabs, toggleBookmark, toggleMute]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 2147483647,
        backgroundColor: animatingIn ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        backdropFilter: animatingIn ? 'blur(4px)' : 'blur(0px)',
        transition: 'background-color 150ms ease-out, backdrop-filter 150ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) hide();
      }}
    >
      <div
        className="w-[680px] max-h-[70vh] flex flex-col rounded-2xl border border-white/[0.12] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(255,255,255,0.1) inset',
          opacity: animatingIn ? 1 : 0,
          transform: animatingIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      >
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          windowFilter={windowFilter}
          onWindowFilterChange={setWindowFilter}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
        />

        {isCommandMode ? (
          <CommandPalette
            query={commandQuery}
            commands={commands}
            onClose={() => setQuery('')}
          />
        ) : (
          <>
            <TabList
              tabs={displayTabs}
              selectedIndex={selectedIndex}
              query={query}
              onSelect={switchToTab}
              onClose={closeTab}
              onTogglePin={togglePin}
              onToggleSelect={toggleSelect}
              onToggleBookmark={toggleBookmark}
              onSaveNote={saveNote}
              onSnooze={snoozeTab}
              onMoveToWindow={moveToWindow}
              onReorderTabs={reorderTabs}
              onToggleMute={toggleMute}
              onCloseByDomain={closeByDomain}
              otherWindows={otherWindows.filter((w) => w.windowId !== currentWindowId)}
              onHover={setSelectedIndex}
              showUrls={settings?.showUrls ?? true}
              selectedTabs={selectedTabs}
              duplicateUrls={duplicateUrls}
              bookmarkedUrls={bookmarkedUrls}
              notesMap={notesMap}
              sortMode={sortMode}
            />

            <GroupSuggestions tabs={tabs} onGroup={groupSuggestionTabs} />

            <SnoozedSection onWake={fetchTabs} />

            <RecentlyClosedSection recentTabs={recentTabs} onRestore={restoreSession} />
          </>
        )}

        <StatusBar
          count={displayTabs.length}
          total={tabs.length}
          query={query}
          selectedCount={selectedTabs.size}
          duplicateCount={duplicateCount.total}
          onCloseSelected={closeSelectedTabs}
          onCloseDuplicates={closeDuplicates}
        />
      </div>

      {showCheatSheet && (
        <CheatSheet onClose={() => setShowCheatSheet(false)} />
      )}

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={() => {
            reopenLastClosed();
            setUndoToast(null);
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}
