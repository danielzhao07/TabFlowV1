import { useEffect, useRef } from 'react';
import { getSnoozeOptions } from '@/lib/snooze';

interface SnoozeMenuProps {
  x: number;
  y: number;
  onSnooze: (durationMs: number) => void;
  onClose: () => void;
}

export function SnoozeMenu({ x, y, onSnooze, onClose }: SnoozeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const options = getSnoozeOptions();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', keyHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', keyHandler, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed rounded-xl border border-white/[0.12] py-1.5 min-w-[180px] overflow-hidden"
      style={{
        left: x,
        top: y,
        zIndex: 2147483647,
        background: 'rgba(20, 20, 40, 0.97)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wider font-medium">
        Snooze tab
      </div>
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => { onSnooze(opt.ms); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-purple-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
