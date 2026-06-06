'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/utils/api';

const FocusContext = createContext(null);

export function FocusProvider({ children }) {
  const { user } = useAuth();
  const [focusGame, setFocusGame] = useState(null); // { gameId, ptId, gameTitle, coverUrl }

  useEffect(() => {
    if (!user) { setFocusGame(null); return; }
    api.settings.get('in_focus')
      .then(val => setFocusGame(val || null))
      .catch(() => setFocusGame(null));
  }, [user]);

  const setFocus = useCallback(async (gameData) => {
    await api.settings.set('in_focus', gameData);
    setFocusGame(gameData);
  }, []);

  const clearFocus = useCallback(async () => {
    await api.settings.set('in_focus', null);
    setFocusGame(null);
  }, []);

  const isFocused = useCallback(
    (gameId) => focusGame != null && String(focusGame.gameId) === String(gameId),
    [focusGame]
  );

  return (
    <FocusContext.Provider value={{ focusGame, setFocus, clearFocus, isFocused }}>
      {children}
    </FocusContext.Provider>
  );
}

export const useFocus = () => useContext(FocusContext);
