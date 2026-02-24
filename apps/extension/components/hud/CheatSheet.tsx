interface CheatSheetProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { section: 'Navigation', items: [
    { keys: '← → ↑ ↓', desc: 'Move selection in grid (2D)' },
    { keys: 'Tab / Shift+Tab', desc: 'Move selection forward/back' },
    { keys: '1-9', desc: 'Jump to tab by position' },
    { keys: 'Enter', desc: 'Switch to selected tab' },
    { keys: 'Esc', desc: 'Close HUD' },
  ]},
  { section: 'Tab Actions', items: [
    { keys: 'Ctrl+X', desc: 'Close selected tab' },
    { keys: 'Ctrl+Shift+X', desc: 'Close all multi-selected tabs' },
    { keys: 'Ctrl+Shift+T', desc: 'Reopen last closed tab' },
    { keys: 'Ctrl+B', desc: 'Bookmark / unbookmark tab' },
    { keys: 'Ctrl+M', desc: 'Mute / unmute audible tab' },
    { keys: 'Double Alt+Q', desc: 'Quick-switch to previous tab' },
    { keys: 'Drag', desc: 'Reorder tabs by dragging' },
  ]},
  { section: 'Selection & Grouping', items: [
    { keys: 'Ctrl+Click', desc: 'Toggle multi-select' },
    { keys: 'Shift+Click', desc: 'Range select' },
    { keys: 'Ctrl+A', desc: 'Select / deselect all' },
    { keys: 'Ctrl+G', desc: 'Group selected tabs' },
    { keys: 'Ctrl+Shift+G', desc: 'Ungroup selected tabs' },
  ]},
  { section: 'View & More', items: [
    { keys: 'Ctrl+F', desc: 'Toggle window filter (all / current)' },
    { keys: 'Ctrl+S', desc: 'Cycle sort mode' },
    { keys: '> ...', desc: 'Open command palette' },
    { keys: 'ai: ...', desc: 'AI semantic search' },
    { keys: 'is:pinned', desc: 'Filter pinned tabs' },
    { keys: 'domain:x', desc: 'Filter by domain' },
    { keys: 'Right-click', desc: 'Context menu (snooze, move, etc.)' },
    { keys: '?', desc: 'Toggle this cheat sheet' },
  ]},
];

export function CheatSheet({ onClose }: CheatSheetProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 2147483647 }}
      onClick={onClose}
    >
      <div
        className="w-[520px] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/[0.12] p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,40,0.97) 0%, rgba(10,10,25,0.97) 100%)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white/90">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {SHORTCUTS.map((section) => (
            <div key={section.section}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400/60 mb-2">
                {section.section}
              </h3>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div key={item.keys} className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-white/50">{item.desc}</span>
                    <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] text-[10px] font-mono text-white/60">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
          <p className="text-[11px] text-white/25">
            Press <kbd className="px-1 py-0.5 rounded bg-white/[0.08] text-[10px] font-mono text-white/40">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-white/[0.08] text-[10px] font-mono text-white/40">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
