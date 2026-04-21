'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const LastVisitedContext = createContext(null);

const STORAGE_KEY = 'grimoire-recent-games';
const MAX_RECENT  = 5;

export const LastVisitedProvider = ({ children }) => {
  // Each entry: { gameId, ptId, gameTitle, coverUrl }
  const [recentGames, setRecentGames] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecentGames(JSON.parse(stored));
    } catch {}
  }, []);

  const recordVisit = (gameId, ptId, gameTitle, coverUrl) => {
    setRecentGames(prev => {
      const filtered = prev.filter(e => String(e.gameId) !== String(gameId));
      const next = [
        { gameId: String(gameId), ptId: String(ptId), gameTitle: gameTitle ?? '', coverUrl: coverUrl ?? null },
        ...filtered,
      ].slice(0, MAX_RECENT);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const visitNotes = (gameId, ptId, gameTitle, coverUrl) => recordVisit(gameId, ptId, gameTitle, coverUrl);
  const visitMap   = (gameId, ptId, gameTitle, coverUrl) => recordVisit(gameId, ptId, gameTitle, coverUrl);

  return (
    <LastVisitedContext.Provider value={{ recentGames, recordVisit, visitNotes, visitMap }}>
      {children}
    </LastVisitedContext.Provider>
  );
};

export const useLastVisited = () => useContext(LastVisitedContext);
