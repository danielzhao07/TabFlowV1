import Fuse from 'fuse.js';
import type { TabInfo } from './types';

interface SearchableTab extends TabInfo {
  note?: string;
}

// Parse structured filters from query: is:pinned, is:audible, is:suspended, is:active, is:duplicate, domain:x
interface ParsedQuery {
  text: string;
  filters: {
    isPinned?: boolean;
    isAudible?: boolean;
    isSuspended?: boolean;
    isActive?: boolean;
    isDuplicate?: boolean;
    domain?: string;
    group?: string;
  };
}

function parseQuery(query: string): ParsedQuery {
  const filters: ParsedQuery['filters'] = {};
  let text = query;

  // Extract is: filters
  text = text.replace(/\bis:pinned\b/gi, () => { filters.isPinned = true; return ''; });
  text = text.replace(/\bis:audible\b/gi, () => { filters.isAudible = true; return ''; });
  text = text.replace(/\bis:suspended\b/gi, () => { filters.isSuspended = true; return ''; });
  text = text.replace(/\bis:active\b/gi, () => { filters.isActive = true; return ''; });
  text = text.replace(/\bis:duplicate\b/gi, () => { filters.isDuplicate = true; return ''; });

  // Extract domain: filter
  text = text.replace(/\bdomain:(\S+)/gi, (_, d) => { filters.domain = d.toLowerCase(); return ''; });

  // Extract group: filter
  text = text.replace(/\bgroup:(\S+)/gi, (_, g) => { filters.group = g.toLowerCase(); return ''; });

  return { text: text.trim(), filters };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function searchTabs(
  tabs: TabInfo[],
  query: string,
  threshold = 0.4,
  notesMap?: Map<string, string>,
  duplicateUrls?: Set<string>,
): TabInfo[] {
  if (!query.trim()) return tabs;

  const { text, filters } = parseQuery(query);

  // Apply structured filters first
  let filtered = tabs;

  if (filters.isPinned !== undefined) {
    filtered = filtered.filter((t) => t.isPinned);
  }
  if (filters.isAudible !== undefined) {
    filtered = filtered.filter((t) => t.isAudible);
  }
  if (filters.isSuspended !== undefined) {
    filtered = filtered.filter((t) => t.isDiscarded);
  }
  if (filters.isActive !== undefined) {
    filtered = filtered.filter((t) => t.isActive);
  }
  if (filters.isDuplicate !== undefined && duplicateUrls) {
    filtered = filtered.filter((t) => duplicateUrls.has(t.url));
  }
  if (filters.domain) {
    const d = filters.domain;
    filtered = filtered.filter((t) => getDomain(t.url).includes(d));
  }
  if (filters.group) {
    const g = filters.group;
    filtered = filtered.filter((t) => t.groupTitle?.toLowerCase().includes(g));
  }

  // If no text query remaining, return filtered results
  if (!text) return filtered;

  // Fuzzy search on the filtered set
  const searchable: SearchableTab[] = notesMap
    ? filtered.map((t) => ({ ...t, note: notesMap.get(t.url) || '' }))
    : filtered;

  const keys = notesMap
    ? [
        { name: 'title', weight: 0.6 },
        { name: 'url', weight: 0.2 },
        { name: 'note', weight: 0.2 },
      ]
    : [
        { name: 'title', weight: 0.7 },
        { name: 'url', weight: 0.3 },
      ];

  const fuse = new Fuse(searchable, {
    keys,
    threshold,
    includeScore: true,
    shouldSort: true,
  });

  return fuse.search(text).map((result) => result.item);
}
