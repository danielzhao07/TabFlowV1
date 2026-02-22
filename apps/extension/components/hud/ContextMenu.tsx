import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Adjust position to keep menu in viewport
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
      className="fixed rounded-xl border border-white/[0.12] py-1 min-w-[180px] overflow-hidden"
      style={{
        left: x,
        top: y,
        zIndex: 2147483647,
        background: 'rgba(20, 20, 40, 0.97)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && <div className="my-1 h-px bg-white/[0.08]" />}
          <button
            onClick={() => { item.action(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12px] transition-colors ${
              item.danger
                ? 'text-red-400/80 hover:bg-red-400/10 hover:text-red-400'
                : 'text-white/70 hover:bg-white/[0.08] hover:text-white/90'
            }`}
          >
            {item.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center opacity-60">{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
