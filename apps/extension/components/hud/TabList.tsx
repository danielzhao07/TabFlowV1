import { useEffect, useRef } from 'react';
import type { TabInfo } from '@/lib/types';
import { TabCard } from './TabCard';

interface TabListProps {
  tabs: TabInfo[];
  selectedIndex: number;
  query: string;
  onSelect: (tabId: number) => void;
  onClose: (tabId: number) => void;
  onTogglePin: (tabId: number, pinned: boolean) => void;
  onToggleSelect: (tabId: number, shiftKey: boolean) => void;
  onToggleBookmark: (tabId: number) => void;
  onHover: (index: number) => void;
  showUrls?: boolean;
  selectedTabs: Set<number>;
  duplicateUrls: Set<string>;
  bookmarkedUrls: Set<string>;
  sortMode: 'mru' | 'domain' | 'title' | 'frecency';
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function TabList({ tabs, selectedIndex, query, onSelect, onClose, onTogglePin, onToggleSelect, onToggleBookmark, onHover, showUrls = true, selectedTabs, duplicateUrls, bookmarkedUrls, sortMode }: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-white/30">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm">No matching tabs</p>
      </div>
    );
  }

  // Build domain group headers for domain sort mode
  let lastDomain = '';

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 py-1">
      {tabs.map((tab, index) => {
        const domain = getDomain(tab.url);
        const showDomainHeader = sortMode === 'domain' && !query && domain !== lastDomain;
        if (showDomainHeader) lastDomain = domain;

        return (
          <div key={tab.tabId}>
            {showDomainHeader && (
              <div className="px-5 pt-3 pb-1 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {domain}
                </span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
            )}
            <div
              ref={index === selectedIndex ? selectedRef : undefined}
              onMouseEnter={() => onHover(index)}
            >
              <TabCard
                tab={tab}
                isSelected={index === selectedIndex}
                isMultiSelected={selectedTabs.has(tab.tabId)}
                isDuplicate={duplicateUrls.has(tab.url)}
                isBookmarked={bookmarkedUrls.has(tab.url)}
                mruPosition={index + 1}
                query={query}
                onClick={() => onSelect(tab.tabId)}
                onClose={onClose}
                onTogglePin={onTogglePin}
                onToggleSelect={onToggleSelect}
                onToggleBookmark={onToggleBookmark}
                showUrl={showUrls}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
