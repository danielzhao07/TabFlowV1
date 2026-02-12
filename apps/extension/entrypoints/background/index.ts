import { initializeMRU, pushToFront, updateTab, removeTab } from '@/lib/mru';
import { getSettings } from '@/lib/settings';
import { getMRUList } from '@/lib/storage';
import { recordVisit } from '@/lib/frecency';
import { getBookmarks, addBookmark, removeBookmark } from '@/lib/bookmarks';

export default defineBackground(() => {
  // Initialize MRU list on install/startup
  initializeMRU();

  // Track tab activation (MRU ordering + frecency)
  chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    await pushToFront(tabId, windowId);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) recordVisit(tab.url);
    } catch { /* tab may not exist */ }
    broadcastUpdate();
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
  });

  // Track tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await removeTab(tabId);
    broadcastUpdate();
  });

  // Track new tabs
  chrome.tabs.onCreated.addListener(async (tab) => {
    if (tab.id) {
      await pushToFront(tab.id, tab.windowId);
      broadcastUpdate();
    }
  });

  // Handle keyboard shortcut
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-hud') {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id && canSendMessage(activeTab.url)) {
        chrome.tabs.sendMessage(activeTab.id, { type: 'toggle-hud' }).catch(() => {
          // Content script not loaded on this tab
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
      return true; // async response
    }
  });

  // Update badge with tab count
  updateBadge();
  chrome.tabs.onCreated.addListener(updateBadge);
  chrome.tabs.onRemoved.addListener(updateBadge);

  // Tab suspender - check every 5 minutes
  chrome.alarms.create('tab-suspender', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
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
  // Only notify tabs where content scripts can actually run
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id && canSendMessage(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { type: 'tabs-updated' }).catch(() => {
          // Content script not loaded on this tab, ignore
        });
      }
    }
  });
}
