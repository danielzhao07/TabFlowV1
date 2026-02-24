import { syncBookmarkToCloud } from './api-client';

const BOOKMARKS_KEY = 'tabflow_bookmarks';

export interface TabBookmark {
  url: string;
  title: string;
  faviconUrl: string;
  createdAt: number;
}

export async function getBookmarks(): Promise<TabBookmark[]> {
  const result = await chrome.storage.local.get(BOOKMARKS_KEY);
  return result[BOOKMARKS_KEY] || [];
}

export async function addBookmark(bookmark: Omit<TabBookmark, 'createdAt'>): Promise<TabBookmark[]> {
  const bookmarks = await getBookmarks();
  // Don't add duplicates
  if (bookmarks.some((b) => b.url === bookmark.url)) return bookmarks;
  const newBookmark: TabBookmark = { ...bookmark, createdAt: Date.now() };
  const updated = [newBookmark, ...bookmarks];
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: updated });
  syncBookmarkToCloud(bookmark.url, bookmark.title, bookmark.faviconUrl).catch(() => {});
  return updated;
}

export async function removeBookmark(url: string): Promise<TabBookmark[]> {
  const bookmarks = await getBookmarks();
  const updated = bookmarks.filter((b) => b.url !== url);
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: updated });
  return updated;
}

export async function isBookmarked(url: string): Promise<boolean> {
  const bookmarks = await getBookmarks();
  return bookmarks.some((b) => b.url === url);
}
