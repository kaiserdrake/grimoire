'use client';

import { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const data = await api.auth.me();
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  const login = async (usernameOrEmail, password) => {
    try {
      const data = await api.auth.login({ usernameOrEmail, password });
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    setUser(null);
    router.push('/');
  };

  const refreshUser = async () => {
    try {
      const data = await api.auth.me();
      setUser(data.user);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
