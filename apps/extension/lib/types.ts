export interface TabInfo {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  faviconUrl: string;
  lastAccessed: number;
  isActive: boolean;
  isPinned: boolean;
  isAudible: boolean;
  isDiscarded: boolean;
  groupId?: number;
  groupTitle?: string;
  groupColor?: string;
}

export interface RecentTab {
  sessionId: string;
  title: string;
  url: string;
  faviconUrl: string;
}

export interface MRUMessage {
  type: 'toggle-hud' | 'get-tabs' | 'get-recent' | 'switch-tab' | 'close-tab' | 'pin-tab' | 'group-tabs' | 'ungroup-tabs' | 'get-bookmarks' | 'add-bookmark' | 'remove-bookmark' | 'restore-session' | 'reopen-last-closed' | 'tabs-updated';
  payload?: any;
}
