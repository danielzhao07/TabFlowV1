import Fuse from 'fuse.js';
import type { TabInfo } from './types';

export function searchTabs(tabs: TabInfo[], query: string, threshold = 0.4): TabInfo[] {
  if (!query.trim()) return tabs;

  const fuse = new Fuse(tabs, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'url', weight: 0.3 },
    ],
    threshold,
    includeScore: true,
    shouldSort: true,
  });

  return fuse.search(query).map((result) => result.item);
}
