import { useState, useRef, useEffect } from 'react';
import { getWorkspaces, saveWorkspace, updateWorkspace, deleteWorkspace, type Workspace } from '@/lib/workspaces';
import type { TabInfo } from '@/lib/types';

interface WorkspaceSectionProps {
  tabs: TabInfo[];
  onRestore?: () => void;
}

export function WorkspaceSection({ tabs, onRestore }: WorkspaceSectionProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const buildTabData = (): Workspace['tabs'] =>
    tabs
      .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('about:'))
      .map((t) => ({ url: t.url, title: t.title, faviconUrl: t.faviconUrl ?? '', groupTitle: t.groupTitle, groupColor: t.groupColor }));

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      const ws = await saveWorkspace(name, buildTabData());
      setWorkspaces((prev) => [ws, ...prev]);
      setNameInput('');
      setShowInput(false);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const updated = await updateWorkspace(id, buildTabData()).catch(() => null);
    if (updated) setWorkspaces((prev) => prev.map((w) => w.id === id ? updated : w));
  };

  const handleRestore = (ws: Workspace) => {
    const urls = ws.tabs
      .map((t) => t.url)
      .filter((u) => u && !u.startsWith('chrome://') && !u.startsWith('chrome-extension://') && !u.startsWith('about:'));
    if (urls.length > 0) {
      chrome.runtime.sendMessage({ type: 'restore-workspace', urls, groups: ws.tabs });
    }
    onRestore?.();
  };

  const handleDelete = async (id: string) => {
    await deleteWorkspace(id).catch(() => {});
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 overflow-x-auto"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.18)' }}
    >
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0 mr-1">Workspaces</span>

      {/* Workspace chips */}
      {workspaces.map((ws) => {
        const isHovered = hoveredId === ws.id;
        return (
          <div
            key={ws.id}
            className="flex items-stretch shrink-0 rounded-md overflow-hidden"
            style={{
              height: 26,
              background: isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isHovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'background 150ms, border-color 150ms',
            }}
            onMouseEnter={() => setHoveredId(ws.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Restore button */}
            <button
              className="flex items-center gap-2 px-2.5"
              style={{ outline: 'none', cursor: 'pointer' }}
              onClick={() => handleRestore(ws)}
              title={`Restore "${ws.name}" (${ws.tabs.length} tabs)`}
            >
              {/* Favicon stack */}
              <div className="flex -space-x-1 shrink-0">
                {ws.tabs.slice(0, 3).map((t, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm bg-white/10 border border-white/[0.06] overflow-hidden shrink-0">
                    {t.faviconUrl && <img src={t.faviconUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{ws.name}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{ws.tabs.length}</span>
            </button>

            {/* Update button */}
            <button
              className="flex items-center justify-center px-1.5"
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#81c995'; (e.currentTarget as HTMLElement).style.background = 'rgba(129,201,149,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => handleUpdate(ws.id)}
              title={`Update "${ws.name}" with current tabs`}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              className="flex items-center justify-center px-1.5"
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f28b82'; (e.currentTarget as HTMLElement).style.background = 'rgba(242,139,130,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => handleDelete(ws.id)}
              title={`Delete "${ws.name}"`}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* Save / Input */}
      {showInput ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setShowInput(false); setNameInput(''); }
            }}
            placeholder="Name…"
            className="bg-white/[0.08] border border-white/[0.14] rounded-md px-2 text-[11px] text-white/80 placeholder-white/25 outline-none"
            style={{ height: 26, width: 90 }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !nameInput.trim()}
            className="px-2 rounded-md bg-white/[0.08] border border-white/[0.12] text-[10px] text-white/50 hover:bg-white/[0.12] disabled:opacity-40 transition-colors"
            style={{ height: 26 }}
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
      ) : (
        <button
          className="flex items-center justify-center rounded-md text-[13px] text-white/25 hover:text-white/55 transition-colors shrink-0"
          style={{
            height: 26,
            width: 26,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onClick={() => setShowInput(true)}
          title="Save current tabs as workspace"
        >
          +
        </button>
      )}
    </div>
  );
}
