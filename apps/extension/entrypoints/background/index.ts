import { initializeMRU, pushToFront, updateTab, removeTab } from '@/lib/mru';
import { getSettings } from '@/lib/settings';
import { getMRUList } from '@/lib/storage';
import { recordVisit } from '@/lib/frecency';
import { getBookmarks, addBookmark, removeBookmark } from '@/lib/bookmarks';
import { getNotesMap, saveNote, deleteNote } from '@/lib/notes';
import { getSnoozedTabs, snoozeTab, removeSnoozedTab, wakeExpiredTabs } from '@/lib/snooze';
import { getApiUrl, getDeviceId } from '@/lib/api-client';
import { signIn, signOut, getStoredTokens } from '@/lib/auth';

// Thumbnail cache: tabId → JPEG dataUrl (max 60 entries)
const tabThumbnails = new Map<number, string>();

// Track whether the HUD overlay is currently visible (skip captures while it's showing)
let hudVisible = false;

// Analytics: track focus time per tab
let activeTabFocusStart = Date.now();
let activeTabMeta: { tabId: number; url: string; domain: string; title: string } | null = null;

function getDomainFromUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

/** Send tab visit analytics to the API (fire and forget) */
async function reportVisit(url: string, domain: string, title: string, durationMs: number) {
  if (!url || !domain || durationMs < 1000) return; // ignore very short visits
  try {
    const [apiUrl, deviceId] = await Promise.all([getApiUrl(), getDeviceId()]);
    fetch(`${apiUrl}/api/analytics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
      body: JSON.stringify({ url, domain, title, durationMs }),
    }).catch(() => {}); // silent fail if API down
  } catch { /* ignore */ }
}

/** Embed a tab in the AI index — throttled to once per 12h per URL */
async function maybeEmbedTab(url: string, title: string) {
  if (!url || !title || !canSendMessage(url)) return;
  try {
    const cacheKey = `embed_ts_${url}`;
    const cache = await chrome.storage.local.get(cacheKey);
    const lastEmbedded = cache[cacheKey] as number | undefined;
    if (lastEmbedded && Date.now() - lastEmbedded < 12 * 3600 * 1000) return;

    const [apiUrl, deviceId] = await Promise.all([getApiUrl(), getDeviceId()]);
    await fetch(`${apiUrl}/api/ai/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
      body: JSON.stringify({ url, title }),
    });
    await chrome.storage.local.set({ [cacheKey]: Date.now() });
  } catch { /* silent fail if API down */ }
}

export default defineBackground(() => {
  // Initialize MRU list on install/startup
  initializeMRU();

  // Log the redirect URL so it can be verified in Cognito settings
  console.log('[TabFlow] Cognito redirect URL:', chrome.identity.getRedirectURL());

  // First install: auto-trigger sign-in popup
  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === 'install') {
      const existing = await getStoredTokens();
      if (!existing) {
        signIn().catch(() => {}); // user may cancel — that's fine
      }
    }
  });

  // Track tab activation (MRU ordering + frecency + thumbnail capture + analytics)
  chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    // Record duration for the tab we're leaving
    if (activeTabMeta) {
      const durationMs = Date.now() - activeTabFocusStart;
      reportVisit(activeTabMeta.url, activeTabMeta.domain, activeTabMeta.title, durationMs);
    }

    await pushToFront(tabId, windowId);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        recordVisit(tab.url);
        // Start tracking new tab
        activeTabFocusStart = Date.now();
        activeTabMeta = {
          tabId,
          url: tab.url,
          domain: getDomainFromUrl(tab.url),
          title: tab.title || '',
        };
        // Auto-embed for AI search (throttled)
        maybeEmbedTab(tab.url, tab.title || '');
      }
    } catch { /* tab may not exist */ }
    broadcastUpdate();

    // Capture immediately — already-loaded tabs render instantly on activation
    captureThumbnail(tabId, windowId);
  });

  // Track tab updates (title, URL, favicon changes)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    const changes: Record<string, any> = {};
    if (changeInfo.title !== undefined) changes.title = changeInfo.title;
    if (changeInfo.url !== undefined) changes.url = changeInfo.url;
    if (changeInfo.favIconUrl !== undefined) changes.faviconUrl = changeInfo.favIconUrl;
    if (changeInfo.pinned !== undefined) changes.isPinned = changeInfo.pinned;
    if (changeInfo.audible !== undefined) changes.isAudible = changeInfo.audible;
    if (changeInfo.discarded !== undefined) changes.isDiscarded = changeInfo.discarded;
    if (changeInfo.groupId !== undefined) {
      changes.groupId = changeInfo.groupId !== -1 ? changeInfo.groupId : undefined;
      if (changeInfo.groupId !== -1) {
        try {
          const group = await chrome.tabGroups.get(changeInfo.groupId);
          changes.groupTitle = group.title || '';
          changes.groupColor = group.color;
        } catch {
          changes.groupTitle = undefined;
          changes.groupColor = undefined;
        }
      } else {
        changes.groupTitle = undefined;
        changes.groupColor = undefined;
      }
    }

    if (Object.keys(changes).length > 0) {
      await updateTab(tabId, changes);
      broadcastUpdate();
    }

    // Re-capture when a tab finishes loading (catches navigation in the active tab)
    if (changeInfo.status === 'complete') {
      try {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (tab?.active) captureThumbnail(tabId, tab.windowId);
      } catch { /* tab may be gone */ }
    }
  });

  // Track tab removal — send targeted message for instant HUD update
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await removeTab(tabId);
    broadcastSpecific({ type: 'tab-removed', tabId });
  });

  // Track new tabs — trigger full refetch in HUD
  chrome.tabs.onCreated.addListener(async (tab) => {
    if (tab.id) {
      await pushToFront(tab.id, tab.windowId);
      broadcastSpecific({ type: 'tab-created' });
    }
  });

  // Handle keyboard shortcut
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-hud') {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id && canSendMessage(activeTab.url)) {
        // Capture BEFORE showing HUD so we get the actual page, not the overlay
        if (!hudVisible) {
          await captureThumbnail(activeTab.id, activeTab.windowId!);
        }
        hudVisible = !hudVisible;
        chrome.tabs.sendMessage(activeTab.id, { type: 'toggle-hud' }).catch(() => {
          // Content script not loaded on this tab
          hudVisible = false; // reset if send failed
        });
      }
    }
  });

  // Handle messages from content script / popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'get-tabs') {
      const senderWindowId = sender.tab?.windowId;
      getMRUList().then((tabs) => sendResponse({ tabs, currentWindowId: senderWindowId }));
      return true; // async response
    }

    if (message.type === 'switch-tab') {
      const { tabId } = message.payload;
      chrome.tabs.update(tabId, { active: true });
      chrome.tabs.get(tabId).then((tab) => {
        chrome.windows.update(tab.windowId, { focused: true });
      });
    }

    if (message.type === 'close-tab') {
      const { tabId } = message.payload;
      chrome.tabs.remove(tabId);
      // onRemoved listener handles MRU cleanup and broadcast
    }

    if (message.type === 'pin-tab') {
      const { tabId, pinned } = message.payload;
      chrome.tabs.update(tabId, { pinned });
      // onUpdated listener handles MRU update and broadcast
    }

    if (message.type === 'group-tabs') {
      const { tabIds, title, color } = message.payload;
      (async () => {
        try {
          const groupId = await chrome.tabs.group({ tabIds });
          if (title) await chrome.tabGroups.update(groupId, { title, color: color || 'cyan' });
          else await chrome.tabGroups.update(groupId, { color: color || 'cyan' });
          broadcastUpdate();
          sendResponse({ success: true, groupId });
        } catch {
          sendResponse({ success: false });
        }
      })();
      return true;
    }

    if (message.type === 'ungroup-tabs') {
      const { tabIds } = message.payload;
      chrome.tabs.ungroup(tabIds).then(() => {
        broadcastUpdate();
        sendResponse({ success: true });
      }).catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message.type === 'get-bookmarks') {
      getBookmarks().then((bookmarks) => sendResponse({ bookmarks }));
      return true;
    }

    if (message.type === 'add-bookmark') {
      const { url, title, faviconUrl } = message.payload;
      addBookmark({ url, title, faviconUrl }).then((bookmarks) => sendResponse({ bookmarks }));
      return true;
    }

    if (message.type === 'remove-bookmark') {
      const { url } = message.payload;
      removeBookmark(url).then((bookmarks) => sendResponse({ bookmarks }));
      return true;
    }

    if (message.type === 'get-notes') {
      getNotesMap().then((notesMap) => {
        sendResponse({ notes: Object.fromEntries(notesMap) });
      });
      return true;
    }

    if (message.type === 'save-note') {
      const { url, note } = message.payload;
      saveNote(url, note).then(() => sendResponse({ success: true }));
      return true;
    }

    if (message.type === 'delete-note') {
      const { url } = message.payload;
      deleteNote(url).then(() => sendResponse({ success: true }));
      return true;
    }

    if (message.type === 'get-recent') {
      chrome.sessions.getRecentlyClosed({ maxResults: 10 }).then((sessions) => {
        const recentTabs = sessions
          .filter((s) => s.tab)
          .map((s) => ({
            sessionId: s.tab!.sessionId!,
            title: s.tab!.title || 'Untitled',
            url: s.tab!.url || '',
            faviconUrl: s.tab!.favIconUrl || '',
          }));
        sendResponse({ recentTabs });
      });
      return true; // async response
    }

    if (message.type === 'restore-session') {
      const { sessionId } = message.payload;
      chrome.sessions.restore(sessionId).then(() => {
        sendResponse({ success: true });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true; // async response
    }

    if (message.type === 'reopen-last-closed') {
      chrome.sessions.getRecentlyClosed({ maxResults: 1 }).then((sessions) => {
        if (sessions.length > 0) {
          const session = sessions[0];
          const sessionId = session.tab?.sessionId ?? session.window?.sessionId;
          if (sessionId) {
            chrome.sessions.restore(sessionId).then(() => {
              sendResponse({ success: true });
            });
          } else {
            sendResponse({ success: false });
          }
        } else {
          sendResponse({ success: false });
        }
      });
      return true;
    }

    // Tab snooze
    if (message.type === 'snooze-tab') {
      const { tabId, url, title, faviconUrl, durationMs } = message.payload;
      const now = Date.now();
      snoozeTab({ url, title, faviconUrl, snoozedAt: now, wakeAt: now + durationMs }).then((tabs) => {
        chrome.tabs.remove(tabId).catch(() => {});
        sendResponse({ success: true, snoozedTabs: tabs });
      });
      return true;
    }

    if (message.type === 'get-snoozed') {
      getSnoozedTabs().then((tabs) => sendResponse({ snoozedTabs: tabs }));
      return true;
    }

    if (message.type === 'cancel-snooze') {
      const { url, wakeAt } = message.payload;
      removeSnoozedTab(url, wakeAt).then((tabs) => sendResponse({ snoozedTabs: tabs }));
      return true;
    }

    // Move tab to window
    if (message.type === 'move-to-window') {
      const { tabId, windowId } = message.payload;
      (async () => {
        try {
          if (windowId === -1) {
            // Move to new window
            await chrome.windows.create({ tabId });
          } else {
            await chrome.tabs.move(tabId, { windowId, index: -1 });
            await chrome.tabs.update(tabId, { active: true });
            await chrome.windows.update(windowId, { focused: true });
          }
          broadcastUpdate();
          sendResponse({ success: true });
        } catch {
          sendResponse({ success: false });
        }
      })();
      return true;
    }

    if (message.type === 'focus-window') {
      const { windowId } = message.payload;
      chrome.windows.update(windowId, { focused: true }).then(() => sendResponse({ success: true }));
      return true;
    }

    if (message.type === 'get-windows') {
      chrome.windows.getAll({ windowTypes: ['normal'] }).then(async (windows) => {
        const result = await Promise.all(
          windows.map(async (w) => {
            const tabs = await chrome.tabs.query({ windowId: w.id });
            const activeTab = tabs.find((t) => t.active);
            return {
              windowId: w.id!,
              tabCount: tabs.length,
              title: activeTab?.title || `Window ${w.id}`,
              faviconUrl: activeTab?.favIconUrl || '',
            };
          })
        );
        sendResponse({ windows: result });
      });
      return true;
    }

    // Mute/unmute tab
    if (message.type === 'mute-tab') {
      const { tabId, muted } = message.payload;
      chrome.tabs.update(tabId, { muted }).then(() => {
        broadcastUpdate();
        sendResponse({ success: true });
      }).catch(() => sendResponse({ success: false }));
      return true;
    }

    // Close tabs by domain
    if (message.type === 'close-by-domain') {
      const { domain, excludeTabId } = message.payload;
      (async () => {
        const allTabs = await chrome.tabs.query({});
        const toClose = allTabs.filter((t) => {
          if (t.id === excludeTabId) return false;
          try {
            return new URL(t.url || '').hostname.replace('www.', '') === domain;
          } catch { return false; }
        });
        for (const t of toClose) {
          if (t.id) chrome.tabs.remove(t.id).catch(() => {});
        }
        sendResponse({ success: true, count: toClose.length });
      })();
      return true;
    }

    // Sign in/out — chrome.identity is only available in background, not content scripts
    if (message.type === 'sign-in') {
      signIn()
        .then((tokenSet) => sendResponse({ success: true, tokenSet }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.type === 'sign-out') {
      signOut()
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    // HUD visibility tracking — so we skip thumbnail captures while HUD is showing
    if (message.type === 'hud-closed') {
      hudVisible = false;
      sendResponse({ success: true });
      return true;
    }

    // Workspace restore — open all tabs in a new window
    if (message.type === 'restore-workspace') {
      chrome.windows.create({ url: message.urls });
      sendResponse({ success: true });
      return true;
    }

    // Return all cached tab thumbnails
    if (message.type === 'get-all-thumbnails') {
      sendResponse({ thumbnails: Object.fromEntries(tabThumbnails) });
      return true;
    }

    // Quick-switch: toggle between last two tabs
    if (message.type === 'quick-switch') {
      getMRUList().then((tabs) => {
        // Find the second tab in MRU (index 1 = previous tab)
        const prev = tabs[1];
        if (prev) {
          chrome.tabs.update(prev.tabId, { active: true });
          chrome.windows.update(prev.windowId, { focused: true });
        }
        sendResponse({ success: !!prev });
      });
      return true;
    }
  });

  // Update badge with tab count
  updateBadge();
  chrome.tabs.onCreated.addListener(updateBadge);
  chrome.tabs.onRemoved.addListener(updateBadge);

  // Snooze waker - check every minute for tabs to wake
  chrome.alarms.create('snooze-waker', { periodInMinutes: 1 });

  // Tab suspender - check every 5 minutes
  chrome.alarms.create('tab-suspender', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'snooze-waker') {
      await wakeExpiredTabs();
      return;
    }
    if (alarm.name !== 'tab-suspender') return;
    const settings = await getSettings();
    if (!settings.autoSuspend) return;

    const mruList = await getMRUList();
    const now = Date.now();
    const threshold = settings.autoSuspendMinutes * 60 * 1000;

    for (const tabInfo of mruList) {
      if (tabInfo.isActive || tabInfo.isPinned || tabInfo.isAudible) continue;
      if (now - tabInfo.lastAccessed < threshold) continue;

      try {
        const tab = await chrome.tabs.get(tabInfo.tabId);
        if (!tab.discarded && !tab.active) {
          chrome.tabs.discard(tabInfo.tabId).catch(() => {});
        }
      } catch {
        // Tab no longer exists
      }
    }
  });
});

async function captureThumbnail(tabId: number, windowId: number) {
  if (hudVisible) return; // skip capture while HUD overlay is showing
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !canSendMessage(tab.url)) return;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 55 });
    tabThumbnails.set(tabId, dataUrl);
    if (tabThumbnails.size > 60) tabThumbnails.delete(tabThumbnails.keys().next().value!);
  } catch { /* capture may fail on restricted pages */ }
}

// Check if we can send messages to a tab (content scripts can't run on these URLs)
function canSendMessage(url: string | undefined): boolean {
  if (!url) return false;
  return !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:') &&
    !url.startsWith('edge://') &&
    !url.startsWith('brave://');
}

async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  const count = tabs.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
  chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

function broadcastUpdate() {
  broadcastSpecific({ type: 'tabs-updated' });
}

function broadcastSpecific(payload: object) {
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id && canSendMessage(tab.url)) {
        chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
      }
    }
  });
}
