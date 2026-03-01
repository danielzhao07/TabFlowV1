const FRECENCY_KEY = 'tabflow_frecency';

interface FrecencyEntry {
  url: string;
  visitCount: number;
  lastVisit: number;
}

export async function getFrecencyMap(): Promise<Map<string, FrecencyEntry>> {
  const result = await chrome.storage.local.get(FRECENCY_KEY);
  const entries: FrecencyEntry[] = result[FRECENCY_KEY] || [];
  return new Map(entries.map((e) => [e.url, e]));
}

export async function recordVisit(url: string): Promise<void> {
  if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return;
  const map = await getFrecencyMap();
  const existing = map.get(url);
  if (existing) {
    existing.visitCount++;
    existing.lastVisit = Date.now();
  } else {
    map.set(url, { url, visitCount: 1, lastVisit: Date.now() });
  }
  // Keep only top 500 entries to avoid unbounded growth
  const entries = [...map.values()]
    .sort((a, b) => computeScore(b) - computeScore(a))
    .slice(0, 500);
  await chrome.storage.local.set({ [FRECENCY_KEY]: entries });
}

export function computeScore(entry: FrecencyEntry): number {
  const hoursSinceVisit = (Date.now() - entry.lastVisit) / (1000 * 60 * 60);
  // Decay factor: halves every 24 hours
  const recency = Math.pow(0.5, hoursSinceVisit / 24);
  // Frequency: log scale to avoid heavy hitters dominating
  const frequency = Math.log2(entry.visitCount + 1);
  return frequency * recency;
}

export async function getScoreForUrl(url: string): Promise<number> {
  const map = await getFrecencyMap();
  const entry = map.get(url);
  return entry ? computeScore(entry) : 0;
}
