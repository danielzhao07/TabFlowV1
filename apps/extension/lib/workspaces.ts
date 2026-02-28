export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  tabs: { title: string; url: string; faviconUrl: string }[];
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

export async function restoreWorkspace(id: string): Promise<void> {
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find((w) => w.id === id);
  if (!workspace) return;

  for (const tab of workspace.tabs) {
    if (tab.url) {
      await chrome.tabs.create({ url: tab.url });
    }
  }
}

export async function deleteWorkspace(id: string): Promise<void> {
  const workspaces = await getWorkspaces();
  const filtered = workspaces.filter((w) => w.id !== id);
  await chrome.storage.local.set({ [WORKSPACES_KEY]: filtered });
}
