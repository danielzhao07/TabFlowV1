interface StatusBarProps {
  count: number;
  total: number;
  query: string;
  selectedCount: number;
  duplicateCount: number;
  onCloseSelected: () => void;
  onCloseDuplicates: () => void;
}

export function StatusBar({ count, total, query, selectedCount, duplicateCount, onCloseSelected, onCloseDuplicates }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/10 text-xs text-white/40">
      <div className="flex items-center gap-3">
        <span>
          {query ? `${count} of ${total} tabs` : `${total} tabs`}
        </span>
        {duplicateCount > 0 && (
          <button
            onClick={onCloseDuplicates}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400/80 hover:text-amber-400 hover:bg-amber-400/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''}
          </button>
        )}
        {selectedCount > 0 && (
          <button
            onClick={onCloseSelected}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-400/10 text-red-400/80 hover:text-red-400 hover:bg-red-400/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close {selectedCount} selected
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">↑↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">1-9</kbd>
          jump
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">↵</kbd>
          switch
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">^X</kbd>
          close tab
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">esc</kbd>
          dismiss
        </span>
      </div>
    </div>
  );
}
