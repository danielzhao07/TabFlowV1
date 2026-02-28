import { useState, useRef, useEffect } from 'react';
import { getWorkspaces, saveWorkspace, deleteWorkspace, type Workspace } from '@/lib/workspaces';
import type { TabInfo } from '@/lib/types';

interface WorkspaceSectionProps {
  tabs: TabInfo[];
}

export function WorkspaceSection({ tabs }: WorkspaceSectionProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const tabData = tabs
        .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('about:'))
        .map((t) => ({ url: t.url, title: t.title, faviconUrl: t.faviconUrl }));
      const ws = await saveWorkspace(name, tabData);
      setWorkspaces((prev) => [ws, ...prev]);
      setNameInput('');
      setShowInput(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save — is the API running?');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (ws: Workspace) => {
    const urls = ws.tabs
      .map((t) => t.url)
      .filter((u) => u && !u.startsWith('chrome://') && !u.startsWith('chrome-extension://') && !u.startsWith('about:'));
    if (urls.length > 0) {
      chrome.runtime.sendMessage({ type: 'restore-workspace', urls });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteWorkspace(id).catch(() => {});
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  };


  return (
    <div
      className="border-t border-white/[0.06] shrink-0"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-[10px] text-white/25 uppercase tracking-wider">Workspaces</span>

        {/* Save current button */}
        {!showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] text-[10px] text-white/30 hover:text-white/50 transition-colors"
          >
            + Save current
          </button>
        )}

        {/* Name input */}
        {showInput && (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              ref={inputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setShowInput(false); setNameInput(''); }
              }}
              placeholder="Workspace name…"
              className="flex-1 bg-white/[0.06] border border-white/[0.12] rounded-md px-2 py-0.5 text-[11px] text-white/80 placeholder-white/25 outline-none"
            />
            <button
              onClick={handleSave}
              disabled={saving || !nameInput.trim()}
              className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.12] text-[10px] text-white/50 hover:bg-white/[0.12] disabled:opacity-40 transition-colors"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              onClick={() => { setShowInput(false); setNameInput(''); }}
              className="text-white/25 hover:text-white/50 text-[10px]"
            >
              ✕
            </button>
          </div>
        )}

        {error && <span className="text-[10px] text-red-400/70 ml-auto">{error}</span>}
      </div>

      {/* Workspace cards */}
      {workspaces.length > 0 && (
        <div className="flex items-center gap-2 px-3 pb-2 overflow-x-auto">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] shrink-0 group"
            >
              <button
                onClick={() => handleRestore(ws)}
                className="flex items-center gap-2 hover:text-white/80 transition-colors"
              >
                <div className="flex -space-x-1.5">
                  {ws.tabs.slice(0, 4).map((t, i) => (
                    <div
                      key={i}
                      className="w-3.5 h-3.5 rounded-sm bg-white/10 border border-white/[0.08] overflow-hidden"
                    >
                      {t.faviconUrl && (
                        <img src={t.faviconUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-white/50 group-hover:text-white/70">{ws.name}</span>
                <span className="text-[10px] text-white/20">{ws.tabs.length}</span>
              </button>
              <button
                onClick={() => handleDelete(ws.id)}
                className="text-white/15 hover:text-red-400/70 transition-colors text-[9px] ml-0.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
