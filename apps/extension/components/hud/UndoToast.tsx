import { useState, useEffect } from 'react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setVisible(false);
        setTimeout(onDismiss, 150);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.12] overflow-hidden"
      style={{
        zIndex: 2147483647,
        background: 'rgba(20, 20, 40, 0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(12px)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
    >
      <span className="text-[12px] text-white/70">{message}</span>
      <button
        onClick={() => {
          onUndo();
          setVisible(false);
          setTimeout(onDismiss, 150);
        }}
        className="px-2.5 py-1 rounded-md bg-cyan-400/20 text-cyan-300 text-[11px] font-medium hover:bg-cyan-400/30 transition-colors"
      >
        Undo
      </button>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.06]">
        <div
          className="h-full bg-cyan-400/40 transition-[width] duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
