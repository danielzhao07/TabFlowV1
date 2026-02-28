export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  tabs: { title: string; url: string; faviconUrl: string; groupTitle?: string; groupColor?: string }[];
}

const WORKSPACES_KEY = 'tabflow_workspaces';

export async function getWorkspaces(): Promise<Workspace[]> {
  const result = await chrome.storage.local.get(WORKSPACES_KEY);
  return result[WORKSPACES_KEY] || [];
}

export async function saveWorkspace(name: string, tabs: Workspace['tabs']): Promise<Workspace> {
  const workspace: Workspace = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    tabs,
  };

  const workspaces = await getWorkspaces();
  workspaces.unshift(workspace);
  await chrome.storage.local.set({ [WORKSPACES_KEY]: workspaces });
  return workspace;
}

export async function updateWorkspace(id: string, tabs: Workspace['tabs']): Promise<Workspace | null> {
  const workspaces = await getWorkspaces();
  const idx = workspaces.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  workspaces[idx] = { ...workspaces[idx], tabs, createdAt: Date.now() };
  await chrome.storage.local.set({ [WORKSPACES_KEY]: workspaces });
  return workspaces[idx];
}

export async function deleteWorkspace(id: string): Promise<void> {
  const workspaces = await getWorkspaces();
  const filtered = workspaces.filter((w) => w.id !== id);
  await chrome.storage.local.set({ [WORKSPACES_KEY]: filtered });
}
