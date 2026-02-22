import { getSettings, saveSettings, type TabFlowSettings } from './settings';
import { getWorkspaces, type Workspace } from './workspaces';
import { getBookmarks, type TabBookmark } from './bookmarks';
import { getNotes, type TabNote } from './notes';

export interface TabFlowExport {
  version: 1;
  exportedAt: number;
  settings: TabFlowSettings;
  workspaces: Workspace[];
  bookmarks: TabBookmark[];
  notes: TabNote[];
}

export async function exportData(): Promise<TabFlowExport> {
  const [settings, workspaces, bookmarks, notes] = await Promise.all([
    getSettings(),
    getWorkspaces(),
    getBookmarks(),
    getNotes(),
  ]);

  return {
    version: 1,
    exportedAt: Date.now(),
    settings,
    workspaces,
    bookmarks,
    notes,
  };
}

export async function importData(data: TabFlowExport): Promise<{ imported: string[] }> {
  const imported: string[] = [];

  if (data.settings) {
    await saveSettings(data.settings);
    imported.push('settings');
  }

  if (data.workspaces?.length > 0) {
    await chrome.storage.local.set({ tabflow_workspaces: data.workspaces });
    imported.push(`${data.workspaces.length} workspaces`);
  }

  if (data.bookmarks?.length > 0) {
    await chrome.storage.local.set({ tabflow_bookmarks: data.bookmarks });
    imported.push(`${data.bookmarks.length} bookmarks`);
  }

  if (data.notes?.length > 0) {
    await chrome.storage.local.set({ tabflow_notes: data.notes });
    imported.push(`${data.notes.length} notes`);
  }

  return { imported };
}

export function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
