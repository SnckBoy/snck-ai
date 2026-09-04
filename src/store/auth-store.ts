'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: 'OWNER' | 'USER';
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  load: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  async load() {
    try {
      const res = await api<{ user: SessionUser | null }>('/api/auth/session', {
        cache: 'no-store',
      });
      set({ user: res.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  setUser(u) {
    set({ user: u, loading: false });
  },
  async logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      set({ user: null });
    }
  },
}));
