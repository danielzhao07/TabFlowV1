import { useRef, useState, useEffect } from 'react';
import type { TabInfo } from '@/lib/types';
import { GridCard } from './GridCard';
import type { TabActions } from '@/lib/hooks/useTabActions';

// Chrome's actual muted/pastel group colors
const GROUP_COLORS: Record<string, string> = {
  blue: '#8ab4f8', cyan: '#78d9ec', green: '#81c995', yellow: '#fdd663',
  orange: '#fcad70', red: '#f28b82', pink: '#ff8bcb', purple: '#c58af9',
  grey: '#9aa0a6',
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

const FOLDER_TAB_H = 26; // height of the label that sticks up above the group outline

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
      if (entry) setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
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

  // Sort: grouped tabs first (by group order), ungrouped last
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

  // Balanced cols lookup
  const COLS_LOOKUP = [0, 1, 2, 3, 2, 3, 3, 4, 4, 3, 5, 4, 4];
  const cols = Math.max(1, Math.min(N, N <= 12
    ? (COLS_LOOKUP[N] ?? Math.ceil(Math.sqrt(N)))
    : Math.min(6, Math.ceil(Math.sqrt(N)))));
  const rows = Math.ceil(N / cols);

  const cardW = Math.min(300, Math.max(130, Math.floor(
    (containerSize.w - pad * 2 - gap * (cols - 1)) / cols
  )));

  // Count rows that will need extra top space for folder tab labels
  // (any row that contains the first occurrence of a group)
  // We'll compute this properly during the segmenting pass below.
  // First pass: figure out how many rows have group-first segments
  let groupFirstRowCount = 0;
  {
    const seen = new Set<number>();
    for (let r = 0; r < rows; r++) {
      const start = r * cols;
      const rowCards = sortedTabs.slice(start, start + cols);
      let hasFirst = false;
      let i = 0;
      while (i < rowCards.length) {
        const gid = rowCards[i].groupId;
        if (gid && !seen.has(gid)) { seen.add(gid); hasFirst = true; }
        i++;
      }
      if (hasFirst) groupFirstRowCount++;
    }
  }

  const availH = containerSize.h - pad * 2
    - groupFirstRowCount * FOLDER_TAB_H  // extra space above rows with first group appearances
    - (rows - 1) * gap;
  const maxCardH = rows > 0 ? Math.floor(availH / rows) : 120;
  const cardH = Math.max(80, Math.min(maxCardH, Math.floor(cardW * 9 / 16)));

  // Segment each row into runs of same-group / ungrouped cards
  interface Segment {
    cards: Array<{ tab: TabInfo; flatIndex: number }>;
    groupId?: number;
    color?: string;
    title?: string;
    isFirstRow: boolean; // first time this group appears in the grid
  }

  const seenGroups = new Set<number>();

  interface RowData {
    segments: Segment[];
    hasGroupFirst: boolean;
  }

  const rowData: RowData[] = [];

  for (let r = 0; r < rows; r++) {
    const start = r * cols;
    const rowCards = sortedTabs.slice(start, start + cols).map((tab, j) => ({
      tab,
      flatIndex: start + j,
    }));

    const segments: Segment[] = [];
    let i = 0;
    while (i < rowCards.length) {
      const card = rowCards[i];
      const gid = card.tab.groupId;
      if (gid) {
        let j = i;
        while (j < rowCards.length && rowCards[j].tab.groupId === gid) j++;
        const isFirstRow = !seenGroups.has(gid);
        if (isFirstRow) seenGroups.add(gid);
        segments.push({
          cards: rowCards.slice(i, j),
          groupId: gid,
          color: card.tab.groupColor ? (GROUP_COLORS[card.tab.groupColor] ?? '#6b7280') : '#6b7280',
          title: card.tab.groupTitle || '',
          isFirstRow,
        });
        i = j;
      } else {
        segments.push({ cards: [card], isFirstRow: false });
        i++;
      }
    }

    rowData.push({
      segments,
      hasGroupFirst: segments.some((s) => s.isFirstRow),
    });
  }

  // Reusable card renderer; groupColor applies a per-card colored outline
  const renderCard = ({ tab, flatIndex: fi }: { tab: TabInfo; flatIndex: number }, groupColor?: string) => (
    <div
      key={tab.tabId}
      className="group"
      style={{
        width: cardW, height: cardH, flexShrink: 0,
        transition: 'width 180ms ease, height 180ms ease',
        borderRadius: 10,
        boxShadow: groupColor ? `0 0 0 1.5px ${groupColor}99` : undefined,
      }}
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

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
      style={{ padding: pad, overflow: 'visible' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: 'center' }}>
        {rowData.map(({ segments, hasGroupFirst }, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: 'flex',
              gap,
              // Extra top margin so folder tab labels have room above the row
              marginTop: hasGroupFirst ? FOLDER_TAB_H : 0,
            }}
          >
            {segments.map((seg, sIdx) => {
              if (!seg.groupId) {
                // Ungrouped cards — render directly
                return seg.cards.map(renderCard);
              }

              const color = seg.color!;
              return (
                <div
                  key={`${seg.groupId}-${rowIdx}-${sIdx}`}
                  style={{
                    display: 'flex',
                    gap,
                    position: 'relative',
                    // Dimmed outline — pastel color at 60% opacity
                    boxShadow: `0 0 0 1.5px ${color}99`,
                    borderRadius: 8,
                    // Tinted background
                    background: `linear-gradient(135deg, ${color}30 0%, ${color}1a 100%)`,
                    backgroundColor: color + '26',
                  }}
                >
                  {/* Folder tab label — sticks up above the outline */}
                  {seg.isFirstRow && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 12,
                      height: FOLDER_TAB_H + 1, // +1 so bottom edge merges with the box-shadow border
                      paddingLeft: 20,
                      paddingRight: 12,
                      background: `linear-gradient(to bottom, ${color}48, ${color}30)`,
                      border: `1.5px solid ${color}99`,
                      borderBottom: 'none',
                      borderRadius: '6px 6px 0 0',
                      fontSize: 10,
                      fontWeight: 700,
                      color,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {seg.title || 'Group'}
                    </div>
                  )}

                  {seg.cards.map((c) => renderCard(c, color))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
