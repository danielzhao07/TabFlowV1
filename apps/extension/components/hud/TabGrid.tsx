import { useRef } from 'react';
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
  thumbnails?: Map<number, string>;
}

export function TabGrid({
  tabs, selectedIndex, selectedTabs, bookmarkedUrls, duplicateUrls,
  notesMap, otherWindows, actions, cols, thumbnails,
}: TabGridProps) {
  const dragFromRef = useRef<number | null>(null);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/25">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm">No tabs found</p>
      </div>
    );
  }

  const rows = Math.ceil(tabs.length / cols);

  return (
    <div
      className="flex-1 min-h-0"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 10,
        padding: 12,
        overflow: 'hidden',
      }}
    >
      {tabs.map((tab, index) => (
        <div
          key={tab.tabId}
          className="group h-full min-h-0"
          draggable
          onDragStart={() => { dragFromRef.current = index; }}
          onDragEnd={() => { dragFromRef.current = null; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFromRef.current !== null && dragFromRef.current !== index) {
              actions.reorderTabs(dragFromRef.current, index);
            }
            dragFromRef.current = null;
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
            animDelay={Math.min(index * 15, 150)}
          />
        </div>
      ))}
    </div>
  );
}
