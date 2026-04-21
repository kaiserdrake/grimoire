'use client';

import { createContext, useContext, useState } from 'react';

const TabStateContext = createContext(null);

const STORAGE_KEY = 'grimoire:listViewMode';

function getInitialViewMode() {
  if (typeof window === 'undefined') return 'list';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'grid' || stored === 'list') return stored;
  } catch {}
  return 'list';
}

export const TabStateProvider = ({ children }) => {
  // ── List tab ──────────────────────────────────────────────────────────────
  const [listState, setListState] = useState({
    activeFilters: ['playing', 'backlog', 'wishlist', 'favorite', 'completed', 'pend', 'other'],
    grouped:       false,
    search:        '',
    showSearch:    false,
    sortBy:        'default',
    viewMode:      getInitialViewMode(),
  });

  // ── Timeline tab ─────────────────────────────────────────────────────────
  const [calendarState, setCalendarState] = useState({

    preset: '6m',
  });

  // ── Notes tab ────────────────────────────────────────────────────────────
  const [notesState, setNotesState] = useState({
    activePtId:   null,
    activeFileId: null,
    editorMode:   'edit',
    content:      '',   // cached editor content — avoids re-fetch on tab return
    saved:        '',   // last-saved server content — used for dirty detection
  });

  // ── Map tab ───────────────────────────────────────────────────────────────
  const [mapState, setMapState] = useState({
    activeMap:    null, // full map object (has image_url, name, etc.)
    activeMapId:  null, // redundant but kept for quick ID checks
    activePtId:   null,
    activePinId:  null,
  });

  return (
    <TabStateContext.Provider value={{
      listState,     setListState,
      calendarState, setCalendarState,
      notesState,    setNotesState,
      mapState,      setMapState,

    }}>
      {children}
    </TabStateContext.Provider>
  );
};

export const useTabState = () => useContext(TabStateContext);
