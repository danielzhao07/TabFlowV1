import type { OtherWindow } from '@/lib/hooks/useHudState';

interface WindowStripProps {
  windows: OtherWindow[];
  currentWindowId: number | undefined;
}

export function WindowStrip({ windows, currentWindowId }: WindowStripProps) {
  // Only show strip when there are multiple windows
  if (windows.length <= 1) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06] overflow-x-auto shrink-0"
      style={{ background: 'rgba(0,0,0,0.25)' }}
    >
      {windows.map((w) => {
        const isCurrent = w.windowId === currentWindowId;
        return (
          <button
            key={w.windowId}
            onClick={() => {
              if (!isCurrent) {
                chrome.runtime.sendMessage({ type: 'focus-window', payload: { windowId: w.windowId } });
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0 border transition-colors ${
              isCurrent
                ? 'bg-cyan-400/10 border-cyan-400/25 text-white/70 cursor-default'
                : 'bg-white/[0.04] border-white/[0.07] text-white/35 hover:bg-white/[0.08] hover:text-white/60 hover:border-white/[0.15]'
            }`}
          >
            {w.faviconUrl ? (
              <img src={w.faviconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-3.5 h-3.5 rounded-sm bg-white/15 shrink-0" />
            )}
            <span className="text-[11px] truncate max-w-[140px]">{w.title}</span>
            <span className="text-[10px] text-white/20 shrink-0 ml-0.5">{w.tabCount}</span>
            {isCurrent && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
