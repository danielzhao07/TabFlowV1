import { syncSettingsToCloud } from './api-client';

export interface TabFlowSettings {
  searchThreshold: number; // 0.0 (exact) to 1.0 (loose), default 0.4
  maxResults: number; // max tabs shown in HUD
  showPinnedTabs: boolean;
  showUrls: boolean;
  theme: 'dark' | 'light';
  autoSuspend: boolean; // auto-discard inactive tabs
  autoSuspendMinutes: number; // minutes of inactivity before discarding
  gridColumns: number; // 0 = auto (responsive), otherwise fixed column count
}

const SETTINGS_KEY = 'tabflow_settings';

const DEFAULT_SETTINGS: TabFlowSettings = {
  searchThreshold: 0.4,
  maxResults: 50,
  showPinnedTabs: true,
  showUrls: true,
  theme: 'dark',
  autoSuspend: false,
  autoSuspendMinutes: 30,
  gridColumns: 0,
};

export async function getSettings(): Promise<TabFlowSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

export async function saveSettings(settings: Partial<TabFlowSettings>): Promise<TabFlowSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  syncSettingsToCloud(updated as unknown as Record<string, unknown>).catch(() => {});
  return updated;
}
