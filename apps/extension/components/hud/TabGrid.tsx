import { useEffect, useRef, useState } from 'react';
import type { TabInfo } from '@/lib/types';
import { GridCard } from './GridCard';
import type { TabActions } from '@/lib/hooks/useTabActions';

interface TabGridProps {
  tabs: TabInfo[];
  selectedIndex: number;
  selectedTabs: Set<number>;
  bookmarkedUrls: Set<string>;
  duplicateUrls: Set<string>;
  notesMap: Map<string, string>;
  otherWindows: { windowId: number; tabCount: number; title: string }[];
  actions: TabActions;
  cols: number;
  onColsChange: (cols: number) => void;
  thumbnails?: Map<number, string>;
}

export function TabGrid({
  tabs, selectedIndex, selectedTabs, bookmarkedUrls, duplicateUrls,
  notesMap, otherWindows, actions, cols, onColsChange, thumbnails,
}: TabGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);
  const dragFromRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Measure grid columns from rendered layout
  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!gridRef.current) return;
      const child = gridRef.current.firstElementChild as HTMLElement | null;
      if (!child) return;
      const containerW = gridRef.current.offsetWidth;
      const cardW = child.offsetWidth;
      const measured = Math.round(containerW / (cardW + 12));
      if (measured !== cols && measured > 0) onColsChange(measured);
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [cols, onColsChange]);

  // Scroll selected card into view
  useEffect(() => {
    selectedCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-white/25">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm">No tabs found</p>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="flex-1 overflow-y-auto overflow-x-hidden p-3"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        alignContent: 'start',
      }}
    >
      {tabs.map((tab, index) => (
        <div
          key={tab.tabId}
          ref={index === selectedIndex ? selectedCardRef : undefined}
          className="group"
          draggable
          onDragStart={() => { dragFromRef.current = index; }}
          onDragEnd={() => { dragFromRef.current = null; setDragOver(null); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(index); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFromRef.current !== null && dragFromRef.current !== index) {
              actions.reorderTabs(dragFromRef.current, index);
            }
            setDragOver(null);
          }}
          style={{
            outline: dragOver === index ? '2px solid rgba(6,182,212,0.6)' : 'none',
            borderRadius: 12,
            opacity: dragFromRef.current === index ? 0.5 : 1,
            transition: 'opacity 100ms',
          }}
        >
          <GridCard
            tab={tab}
            index={index}
            isSelected={index === selectedIndex}
            isMultiSelected={selectedTabs.has(tab.tabId)}
            isBookmarked={bookmarkedUrls.has(tab.url)}
            isDuplicate={duplicateUrls.has(tab.url)}
            note={notesMap.get(tab.url)}
            thumbnail={thumbnails?.get(tab.tabId)}
            onSwitch={actions.switchToTab}
            onClose={actions.closeTab}
            onTogglePin={actions.togglePin}
            onToggleSelect={actions.toggleSelect}
            onToggleBookmark={actions.toggleBookmark}
            onSnooze={actions.snoozeTab}
            onMoveToWindow={actions.moveToWindow}
            onToggleMute={actions.toggleMute}
            otherWindows={otherWindows}
            animDelay={Math.min(index * 18, 200)}
          />
        </div>
      ))}
    </div>
  );
}
