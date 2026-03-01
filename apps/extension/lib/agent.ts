export type AgentAction =
  | { type: 'group-tabs'; tabIds: number[]; title: string; color?: string }
  | { type: 'open-urls-in-group'; urls: string[]; title: string; color?: string }
  | { type: 'close-tab'; tabId: number }
  | { type: 'close-tabs'; tabIds: number[] }
  | { type: 'open-url'; url: string }
  | { type: 'pin-tab'; tabId: number; pinned: boolean }
  | { type: 'mute-tab'; tabId: number; muted: boolean }
  | { type: 'bookmark-tab'; tabId: number; folder?: string }
  | { type: 'switch-tab'; tabId: number }
  | { type: 'move-to-new-window'; tabId: number }
  | { type: 'reload-tab'; tabId: number }
  | { type: 'ungroup-tabs'; tabIds: number[] }
  | { type: 'split-view'; tabId1: number; tabId2: number }
  | { type: 'merge-windows' }
  | { type: 'reopen-last-closed' }
  | { type: 'create-workspace'; name: string };

export interface AgentResult {
  message: string;
  actions: AgentAction[];
}

export function describeAction(action: AgentAction): string {
  switch (action.type) {
    case 'group-tabs': return `Group tabs as "${action.title}"`;
    case 'open-urls-in-group': return `Open ${action.urls.length} tabs in group "${action.title}"`;
    case 'close-tab': return 'Close tab';
    case 'close-tabs': return `Close ${action.tabIds.length} tabs`;
    case 'open-url': return `Open ${action.url}`;
    case 'pin-tab': return action.pinned ? 'Pin tab' : 'Unpin tab';
    case 'mute-tab': return action.muted ? 'Mute tab' : 'Unmute tab';
    case 'bookmark-tab': return action.folder ? `Bookmark tab in "${action.folder}"` : 'Bookmark tab';
    case 'switch-tab': return 'Switch to tab';
    case 'move-to-new-window': return 'Move tab to new window';
    case 'reload-tab': return 'Reload tab';
    case 'ungroup-tabs': return 'Ungroup tabs';
    case 'split-view': return 'Open tabs in split view';
    case 'merge-windows': return 'Merge all windows into one';
    case 'reopen-last-closed': return 'Reopen last closed tab';
    case 'create-workspace': return `Save workspace "${action.name}"`;
    default: return 'Unknown action';
  }
}
