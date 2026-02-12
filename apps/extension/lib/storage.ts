import type { TabInfo } from './types';

const STORAGE_KEY = 'tabflow_mru';

export async function getMRUList(): Promise<TabInfo[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

export async function setMRUList(tabs: TabInfo[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: tabs });
}
