'use client';

import { useCallback, useState } from 'react';
import { Tooltip } from '@chakra-ui/react';
import { FiClock, FiArrowUp, FiArrowDown } from 'react-icons/fi';

// Natural direction for each mode: recent = newest first, alpha = A→Z.
const MODE_DEFAULT_DIR = { recent: 'desc', alpha: 'asc' };
const DEFAULT_SORT = { mode: 'recent', dir: 'desc' };

// Sort preference for a sidebar file tree, persisted in localStorage.
// mode: 'recent' (by modified date) | 'alpha' (by name)
// dir:  'asc' | 'desc'
export function useSidebarSort(storageKey) {
  const [sort, setSort] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SORT;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && MODE_DEFAULT_DIR[saved.mode] && ['asc', 'desc'].includes(saved.dir)) return saved;
    } catch {}
    return DEFAULT_SORT;
  });

  const update = useCallback((fn) => {
    setSort(prev => {
      const next = fn(prev);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  // Switching mode resets direction to that mode's natural default.
  const toggleMode = useCallback(() => update(s => {
    const mode = s.mode === 'recent' ? 'alpha' : 'recent';
    return { mode, dir: MODE_DEFAULT_DIR[mode] };
  }), [update]);

  const toggleDir = useCallback(() => update(s => (
    { ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' }
  )), [update]);

  const sortItems = useCallback((items, getName, getDate) => {
    return [...items].sort((a, b) => {
      const cmp = sort.mode === 'alpha'
        ? (getName(a) || '').localeCompare(getName(b) || '', undefined, { sensitivity: 'base', numeric: true })
        : new Date(getDate(a) || 0) - new Date(getDate(b) || 0);
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }, [sort]);

  return { sort, toggleMode, toggleDir, sortItems };
}

export default function SidebarSortControl({ sort, onToggleMode, onToggleDir }) {
  const isRecent = sort.mode === 'recent';
  const isDesc   = sort.dir === 'desc';
  return (
    <div className="notes-sidebar-sort">
      <Tooltip hasArrow placement="bottom" openDelay={300} fontSize="xs"
        label={isRecent ? 'Sorted by last modified — switch to alphabetical' : 'Sorted alphabetically — switch to last modified'}>
        <button type="button" className="notes-sidebar-sort-btn" onClick={onToggleMode}
          aria-label={isRecent ? 'Sort alphabetically' : 'Sort by last modified'}>
          {isRecent
            ? <FiClock size={11} />
            : <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.02em' }}>AZ</span>}
        </button>
      </Tooltip>
      <Tooltip hasArrow placement="bottom" openDelay={300} fontSize="xs"
        label={isDesc ? 'Descending — switch to ascending' : 'Ascending — switch to descending'}>
        <button type="button" className="notes-sidebar-sort-btn" onClick={onToggleDir}
          aria-label={isDesc ? 'Sort ascending' : 'Sort descending'}>
          {isDesc ? <FiArrowDown size={11} /> : <FiArrowUp size={11} />}
        </button>
      </Tooltip>
    </div>
  );
}
