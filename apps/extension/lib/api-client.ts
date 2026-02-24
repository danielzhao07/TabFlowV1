/**
 * TabFlow API client — talks to the Express.js backend at apps/api.
 * Uses x-device-id for auth (device UUID stored in chrome.storage.local).
 */

const DEFAULT_API_URL = 'http://localhost:3001';

export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get('tabflow_api_url');
  return (result['tabflow_api_url'] as string) ?? DEFAULT_API_URL;
}

export async function getDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get('tabflow_device_id');
  if (result['tabflow_device_id']) return result['tabflow_device_id'] as string;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ tabflow_device_id: id });
  return id;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const [base, deviceId] = await Promise.all([getApiUrl(), getDeviceId()]);
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---- Health check ----
export async function checkHealth(): Promise<boolean> {
  try {
    await fetch(`${await getApiUrl()}/health`);
    return true;
  } catch {
    return false;
  }
}

// ---- AI: embed a tab ----
export async function embedTab(url: string, title: string): Promise<void> {
  await request('/api/ai/embed', {
    method: 'POST',
    body: JSON.stringify({ url, title }),
  });
}

// ---- AI: semantic history search ----
export interface HistoryResult {
  url: string;
  title: string;
  lastSeen: string;
  similarity: number;
}

export async function searchHistory(query: string, limit = 10): Promise<HistoryResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await request<{ results: HistoryResult[] }>(`/api/ai/history?${params}`);
  return data.results;
}

// ---- Analytics: record a tab visit ----
export async function recordVisit(url: string, domain: string, durationMs: number, title?: string): Promise<void> {
  await request('/api/analytics/visit', {
    method: 'POST',
    body: JSON.stringify({ url, domain, durationMs, title }),
  });
}

// ---- Analytics: top domains ----
export interface DomainStat {
  domain: string;
  total_visits: number;
  total_duration_ms: number;
  unique_pages: number;
}

export async function getTopDomains(limit = 5): Promise<DomainStat[]> {
  const data = await request<{ domains: DomainStat[] }>(`/api/analytics/top-domains?limit=${limit}`);
  return data.domains;
}

// ---- Sync: workspaces ----
export interface Workspace {
  id: string;
  name: string;
  tabs: Array<{ url: string; title: string; faviconUrl?: string }>;
  createdAt: string;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const data = await request<{ workspaces: Workspace[] }>('/api/sync/workspaces');
  return data.workspaces;
}

export async function saveWorkspace(name: string, tabs: Workspace['tabs']): Promise<Workspace> {
  return request<Workspace>('/api/sync/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name, tabs }),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await request(`/api/sync/workspaces/${id}`, { method: 'DELETE' });
}
