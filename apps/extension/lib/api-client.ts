/**
 * TabFlow API client — talks to the Express.js backend at apps/api.
 * The API URL is stored in chrome.storage.local under 'tabflow_api_url'.
 * Defaults to http://localhost:3001 for local development.
 */

const DEFAULT_API_URL = 'http://localhost:3001';

export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get('tabflow_api_url');
  return (result['tabflow_api_url'] as string) ?? DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ tabflow_api_url: url });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = await getApiUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---- Health check ----
export async function checkHealth(): Promise<boolean> {
  try {
    await request('/health');
    return true;
  } catch {
    return false;
  }
}

// ---- Semantic search (AI) ----
export interface SemanticResult {
  tabId?: number;
  url: string;
  title: string;
  score: number;
}

export async function semanticSearch(
  query: string,
  userId: string,
  limit = 10,
): Promise<SemanticResult[]> {
  return request<SemanticResult[]>('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ query, limit }),
  });
}

// ---- Sync: workspaces ----
export interface Workspace {
  id: string;
  name: string;
  tabs: Array<{ url: string; title: string; faviconUrl?: string }>;
  createdAt: string;
}

export async function getWorkspaces(userId: string): Promise<Workspace[]> {
  return request<Workspace[]>('/api/sync/workspaces', {
    headers: { 'x-user-id': userId },
  });
}

export async function saveWorkspace(
  userId: string,
  name: string,
  tabs: Workspace['tabs'],
): Promise<Workspace> {
  return request<Workspace>('/api/sync/workspaces', {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: JSON.stringify({ name, tabs }),
  });
}

export async function deleteWorkspace(userId: string, id: string): Promise<void> {
  await request(`/api/sync/workspaces/${id}`, {
    method: 'DELETE',
    headers: { 'x-user-id': userId },
  });
}

// ---- Sync: settings ----
export async function syncSettings(
  userId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await request('/api/sync/settings', {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: JSON.stringify({ settings }),
  });
}
