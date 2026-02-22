const SNOOZE_KEY = 'tabflow_snoozed';

export interface SnoozedTab {
  url: string;
  title: string;
  faviconUrl: string;
  snoozedAt: number;
  wakeAt: number;
}

export async function getSnoozedTabs(): Promise<SnoozedTab[]> {
  const result = await chrome.storage.local.get(SNOOZE_KEY);
  return result[SNOOZE_KEY] || [];
}

export async function snoozeTab(tab: SnoozedTab): Promise<SnoozedTab[]> {
  const tabs = await getSnoozedTabs();
  tabs.push(tab);
  await chrome.storage.local.set({ [SNOOZE_KEY]: tabs });
  return tabs;
}

export async function removeSnoozedTab(url: string, wakeAt: number): Promise<SnoozedTab[]> {
  const tabs = await getSnoozedTabs();
  const filtered = tabs.filter((t) => !(t.url === url && t.wakeAt === wakeAt));
  await chrome.storage.local.set({ [SNOOZE_KEY]: filtered });
  return filtered;
}

export async function wakeExpiredTabs(): Promise<SnoozedTab[]> {
  const tabs = await getSnoozedTabs();
  const now = Date.now();
  const expired = tabs.filter((t) => t.wakeAt <= now);
  const remaining = tabs.filter((t) => t.wakeAt > now);

  if (expired.length > 0) {
    await chrome.storage.local.set({ [SNOOZE_KEY]: remaining });
    for (const tab of expired) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }
  }

  return remaining;
}

export function getSnoozeOptions(): { label: string; ms: number }[] {
  return [
    { label: 'In 1 hour', ms: 60 * 60 * 1000 },
    { label: 'In 3 hours', ms: 3 * 60 * 60 * 1000 },
    { label: 'Tomorrow morning', ms: getMsTomorrowMorning() },
    { label: 'Next week', ms: 7 * 24 * 60 * 60 * 1000 },
  ];
}

function getMsTomorrowMorning(): number {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.getTime() - Date.now();
}
