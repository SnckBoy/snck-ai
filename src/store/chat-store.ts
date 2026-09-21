'use client';

import { create } from 'zustand';
import type { ConversationSummary, ModelOption } from '@/types';

function sameModels(a: ModelOption[], b: ModelOption[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].identifier !== b[i].identifier ||
      a[i].displayName !== b[i].displayName ||
      a[i].providerName !== b[i].providerName
    ) {
      return false;
    }
  }
  return true;
}

interface ChatState {
  conversations: ConversationSummary[];
  conversationsLoaded: boolean;
  selectedModelId: string | null;
  availableModels: ModelOption[];
  setConversations: (c: ConversationSummary[]) => void;
  addOrUpdateConversation: (c: ConversationSummary) => void;
  removeConversation: (id: string) => void;
  setSelectedModelId: (id: string | null) => void;
  setAvailableModels: (m: ModelOption[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  conversationsLoaded: false,
  selectedModelId: null,
  availableModels: [],

  setConversations: (conversations) =>
    set({ conversations, conversationsLoaded: true }),

  addOrUpdateConversation: (c) =>
    set((state) => {
      const exists = state.conversations.some((x) => x.id === c.id);
      const list = exists
        ? state.conversations.map((x) => (x.id === c.id ? c : x))
        : [c, ...state.conversations];
      return { conversations: list };
    }),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((x) => x.id !== id),
    })),

  setSelectedModelId: (id) =>
    set((state) => {
      if (state.selectedModelId === id) return state;
      if (id && typeof window !== 'undefined') localStorage.setItem('snck-model', id);
      return { selectedModelId: id };
    }),

  setAvailableModels: (models) =>
    set((state) => (sameModels(state.availableModels, models) ? state : { availableModels: models })),
}));
