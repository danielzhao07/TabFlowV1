import { useEffect } from 'react';
import type { HudState } from './useHudState';
import type { TabActions } from './useTabActions';

export function useKeyboardNav(
  s: HudState,
  a: TabActions,
  cols: number,
) {
  useEffect(() => {
    if (!s.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = (e.target as HTMLElement)?.tagName === 'INPUT';

      // --- Ctrl combos ---
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.shiftKey) {
          if (e.key === 'X') { e.preventDefault(); if (s.selectedTabs.size > 0) a.closeSelectedTabs(); return; }
          if (e.key === 'T') { e.preventDefault(); a.reopenLastClosed(); return; }
          if (e.key === 'G') { e.preventDefault(); a.ungroupSelectedTabs(); return; }
        } else {
          if (e.key === 'x') { e.preventDefault(); if (s.displayTabs[s.selectedIndex]) a.closeTab(s.displayTabs[s.selectedIndex].tabId); return; }
          if (e.key === 'f') { e.preventDefault(); s.setWindowFilter((p) => p === 'all' ? 'current' : 'all'); return; }
          if (e.key === 'g') { e.preventDefault(); a.groupSelectedTabs(); return; }
          if (e.key === 'b') { e.preventDefault(); if (s.displayTabs[s.selectedIndex]) a.toggleBookmark(s.displayTabs[s.selectedIndex].tabId); return; }
          if (e.key === 'm') { e.preventDefault(); if (s.displayTabs[s.selectedIndex]) a.toggleMute(s.displayTabs[s.selectedIndex].tabId); return; }
          if (e.key === 's') { e.preventDefault(); s.setSortMode((p) => p === 'mru' ? 'frecency' : p === 'frecency' ? 'domain' : p === 'domain' ? 'title' : 'mru'); return; }
          if (e.key === 'a') { e.preventDefault(); a.selectAll(); return; }
        }
        return;
      }

      // --- Non-ctrl ---
      if (!isTyping && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // ? => cheat sheet
        if (e.key === '?') { e.preventDefault(); s.setShowCheatSheet((p) => !p); return; }
        // 1-9 quick-switch
        if (e.key >= '1' && e.key <= '9') {
          const idx = parseInt(e.key) - 1;
          if (s.displayTabs[idx]) { e.preventDefault(); a.switchToTab(s.displayTabs[idx].tabId); }
          return;
        }
      }

      // --- Arrow navigation (2D grid) ---
      const len = s.displayTabs.length;
      if (len === 0) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          s.setSelectedIndex((i) => Math.min(i + 1, len - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'ArrowDown':
          e.preventDefault();
          s.setSelectedIndex((i) => Math.min(i + cols, len - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          s.setSelectedIndex((i) => Math.max(i - cols, 0));
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) s.setSelectedIndex((i) => Math.max(i - 1, 0));
          else s.setSelectedIndex((i) => Math.min(i + 1, len - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (s.displayTabs[s.selectedIndex]) a.switchToTab(s.displayTabs[s.selectedIndex].tabId);
          break;
        case 'Escape':
          e.preventDefault();
          s.hide();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [s, a, cols]);
}
