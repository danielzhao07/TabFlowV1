import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
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
      if (menuRef.current) {
        // composedPath() is required in shadow DOM — e.target retargets to shadow host
        const path = e.composedPath();
        if (!path.includes(menuRef.current as EventTarget)) {
          onClose();
        }
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
      className="fixed py-1 min-w-[160px] overflow-hidden"
      style={{
        left: x,
        top: y,
        zIndex: 2147483647,
        background: 'rgba(22, 22, 36, 0.98)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset',
      }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && <div className="my-1 mx-2 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />}
          <button
            onClick={() => { item.action(); onClose(); }}
            className={`w-full px-3.5 py-1.5 text-left text-[12px] transition-colors ${
              item.danger
                ? 'text-red-400/75 hover:bg-red-500/12 hover:text-red-400'
                : 'text-white/65 hover:bg-white/[0.07] hover:text-white/90'
            }`}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
