import { useRef, useState, useEffect } from 'react';
import type { TabInfo } from '@/lib/types';
import { GridCard } from './GridCard';
import type { TabActions } from '@/lib/hooks/useTabActions';

const GROUP_COLORS: Record<string, string> = {
  blue: '#3b82f6', cyan: '#06b6d4', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', red: '#ef4444', pink: '#ec4899', purple: '#a855f7',
  grey: '#6b7280',
};

interface TabGridProps {
  tabs: TabInfo[];
  selectedIndex: number;
  selectedTabs: Set<number>;
  bookmarkedUrls: Set<string>;
  duplicateUrls: Set<string>;
  notesMap: Map<string, string>;
  actions: TabActions;
  cols: number;
  thumbnails?: Map<number, string>;
}

export function TabGrid({
  tabs, selectedIndex, selectedTabs, bookmarkedUrls, duplicateUrls,
  notesMap, actions, thumbnails,
}: TabGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragFromRef = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Sort tabs: grouped by groupId (ascending), then ungrouped last; preserve order within each group
  const grouped = tabs.filter((t) => t.groupId);
  const ungrouped = tabs.filter((t) => !t.groupId);
  const groupOrder: number[] = [];
  for (const t of grouped) {
    if (t.groupId && !groupOrder.includes(t.groupId)) groupOrder.push(t.groupId);
  }
  const sortedTabs: TabInfo[] = [
    ...groupOrder.flatMap((gid) => grouped.filter((t) => t.groupId === gid)),
    ...ungrouped,
  ];

  const N = sortedTabs.length;
  const pad = 16;
  const gap = 8;
  const headerRowH = 26; // height of each group header row including its gap

  // Dynamic column/row count based on available space and tab count
  const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(N * 1.4))));
  const rows = Math.ceil(N / cols);

  // How many group header rows will render (named groups only, not "Other")
  const numHeaders = groupOrder.length;

  const cardW = Math.min(280, Math.max(130, Math.floor((containerSize.w - pad * 2 - gap * (cols - 1)) / cols)));
  const availH = containerSize.h - pad * 2 - numHeaders * headerRowH - gap * (rows - 1);
  const maxCardH = rows > 0 ? Math.floor(availH / rows) : 120;
  const cardH = Math.max(80, Math.min(maxCardH, Math.floor(cardW * 175 / 240)));

  const hasGroups = sortedTabs.some((t) => t.groupId);

  // Build render items: group header rows + card items
  type RenderItem =
    | { kind: 'header'; groupId: number; title: string; color: string }
    | { kind: 'card'; tab: TabInfo; flatIndex: number };

  const renderItems: RenderItem[] = [];
  let flatIndex = 0;
  let lastGroupId: number | undefined = undefined;

  for (const tab of sortedTabs) {
    if (hasGroups && tab.groupId && tab.groupId !== lastGroupId) {
      lastGroupId = tab.groupId;
      renderItems.push({
        kind: 'header',
        groupId: tab.groupId,
        title: tab.groupTitle || String(tab.groupId),
        color: tab.groupColor ? (GROUP_COLORS[tab.groupColor] ?? '#6b7280') : '#6b7280',
      });
    } else if (tab.groupId !== lastGroupId) {
      lastGroupId = tab.groupId;
    }
    renderItems.push({ kind: 'card', tab, flatIndex });
    flatIndex++;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden flex items-center justify-center"
      style={{ padding: pad }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${cardW}px)`,
          gap,
          justifyContent: 'center',
          alignContent: 'center',
        }}
      >
        {renderItems.map((item) => {
          if (item.kind === 'header') {
            return (
              <div
                key={`header-${item.groupId}`}
                style={{
                  gridColumn: `1 / -1`,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: -2,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 10, color: item.color, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {item.title}
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: item.color + '30' }} />
              </div>
            );
          }

          const { tab, flatIndex: fi } = item;
          return (
            <div
              key={tab.tabId}
              className="group"
              style={{ width: cardW, height: cardH }}
              draggable
              onDragStart={() => { dragFromRef.current = fi; }}
              onDragEnd={() => { dragFromRef.current = null; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFromRef.current !== null && dragFromRef.current !== fi) {
                  actions.reorderTabs(dragFromRef.current, fi);
                }
                dragFromRef.current = null;
              }}
            >
              <GridCard
                tab={tab}
                index={fi}
                isSelected={fi === selectedIndex}
                isMultiSelected={selectedTabs.has(tab.tabId)}
                isBookmarked={bookmarkedUrls.has(tab.url)}
                isDuplicate={duplicateUrls.has(tab.url)}
                note={notesMap.get(tab.url)}
                thumbnail={thumbnails?.get(tab.tabId)}
                onSwitch={actions.switchToTab}
                onClose={actions.closeTab}
                onTogglePin={actions.togglePin}
                onToggleSelect={actions.toggleSelect}
                onDuplicate={actions.duplicateTab}
                onMoveToNewWindow={actions.moveToNewWindow}
                onReload={actions.reloadTab}
                animDelay={Math.min(fi * 12, 120)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
