export interface TabNote {
  url: string;
  note: string;
  updatedAt: number;
}

const NOTES_KEY = 'tabflow_notes';

export async function getNotes(): Promise<TabNote[]> {
  const result = await chrome.storage.local.get(NOTES_KEY);
  return result[NOTES_KEY] || [];
}

export async function getNote(url: string): Promise<TabNote | undefined> {
  const notes = await getNotes();
  return notes.find((n) => n.url === url);
}

export async function saveNote(url: string, note: string): Promise<TabNote[]> {
  const notes = await getNotes();
  const trimmed = note.trim();

  if (!trimmed) {
    // Remove note if empty
    const filtered = notes.filter((n) => n.url !== url);
    await chrome.storage.local.set({ [NOTES_KEY]: filtered });
    return filtered;
  }

  const existing = notes.find((n) => n.url === url);
  if (existing) {
    existing.note = trimmed;
    existing.updatedAt = Date.now();
  } else {
    notes.push({ url, note: trimmed, updatedAt: Date.now() });
  }
  await chrome.storage.local.set({ [NOTES_KEY]: notes });
  return notes;
}

export async function deleteNote(url: string): Promise<TabNote[]> {
  const notes = await getNotes();
  const filtered = notes.filter((n) => n.url !== url);
  await chrome.storage.local.set({ [NOTES_KEY]: filtered });
  return filtered;
}

export async function getNotesMap(): Promise<Map<string, string>> {
  const notes = await getNotes();
  return new Map(notes.map((n) => [n.url, n.note]));
}
