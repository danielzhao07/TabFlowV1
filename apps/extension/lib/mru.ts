import type { TabInfo } from './types';
import { getMRUList, setMRUList } from './storage';

async function getGroupInfo(groupId: number): Promise<{ title: string; color: string } | null> {
  if (groupId === -1 || groupId === undefined) return null;
  try {
    const group = await chrome.tabGroups.get(groupId);
    return { title: group.title || '', color: group.color };
  } catch {
    return null;
  }
}

export async function pushToFront(tabId: number, windowId: number): Promise<TabInfo[]> {
  const list = await getMRUList();
  const index = list.findIndex((t) => t.tabId === tabId);

  if (index >= 0) {
    const [tab] = list.splice(index, 1);
    tab.lastAccessed = Date.now();
    tab.isActive = true;
    // Mark all others as not active
    for (const t of list) t.isActive = false;
    list.unshift(tab);
  } else {
    // New tab - fetch its info from Chrome
    try {
      const chromeTab = await chrome.tabs.get(tabId);
      const groupInfo = await getGroupInfo(chromeTab.groupId);
      const newTab: TabInfo = {
        tabId,
        windowId,
        title: chromeTab.title || 'Untitled',
        url: chromeTab.url || '',
        faviconUrl: chromeTab.favIconUrl || '',
        lastAccessed: Date.now(),
        isActive: true,
        isPinned: chromeTab.pinned || false,
        isAudible: chromeTab.audible || false,
        isDiscarded: chromeTab.discarded || false,
        groupId: chromeTab.groupId !== -1 ? chromeTab.groupId : undefined,
        groupTitle: groupInfo?.title,
        groupColor: groupInfo?.color,
      };
      for (const t of list) t.isActive = false;
      list.unshift(newTab);
    } catch {
      // Tab may have been closed already
      return list;
    }
  }

  await setMRUList(list);
  return list;
}

export async function updateTab(tabId: number, changes: Partial<TabInfo>): Promise<void> {
  const list = await getMRUList();
  const tab = list.find((t) => t.tabId === tabId);
  if (tab) {
    Object.assign(tab, changes);
    await setMRUList(list);
  }
}

export async function removeTab(tabId: number): Promise<void> {
  const list = await getMRUList();
  const filtered = list.filter((t) => t.tabId !== tabId);
  await setMRUList(filtered);
}

export async function initializeMRU(): Promise<void> {
  const allTabs = await chrome.tabs.query({});
  const existingList = await getMRUList();

  // Build a map of existing tabs by ID for fast lookup
  const existingMap = new Map(existingList.map((t) => [t.tabId, t]));

  // Get the currently active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Fetch group info for all unique group IDs
  const groupIds = [...new Set(allTabs.map((t) => t.groupId).filter((id) => id !== -1))];
  const groupMap = new Map<number, { title: string; color: string }>();
  for (const gid of groupIds) {
    const info = await getGroupInfo(gid);
    if (info) groupMap.set(gid, info);
  }

  const newList: TabInfo[] = allTabs.map((tab) => {
    const existing = existingMap.get(tab.id!);
    const groupInfo = tab.groupId !== -1 ? groupMap.get(tab.groupId) : undefined;
    return {
      tabId: tab.id!,
      windowId: tab.windowId,
      title: tab.title || 'Untitled',
      url: tab.url || '',
      faviconUrl: tab.favIconUrl || '',
      lastAccessed: existing?.lastAccessed || Date.now(),
      isActive: tab.id === activeTab?.id,
      isPinned: tab.pinned || false,
      isAudible: tab.audible || false,
      isDiscarded: tab.discarded || false,
      groupId: tab.groupId !== -1 ? tab.groupId : undefined,
      groupTitle: groupInfo?.title,
      groupColor: groupInfo?.color,
    };
  });

  // Sort by lastAccessed descending (most recent first)
  newList.sort((a, b) => b.lastAccessed - a.lastAccessed);
  await setMRUList(newList);
}
