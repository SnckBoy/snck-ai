'use client';

import { create } from 'zustand';
import type { ConversationSummary, ModelOption } from '@/types';

interface ChatState {
  conversations: ConversationSummary[];
  conversationsLoaded: boolean;
  selectedModelId: string | null;
  availableModels: ModelOption[];
  modelsLoaded: boolean;
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
  modelsLoaded: false,

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

  setSelectedModelId: (id) => {
    if (id) localStorage.setItem('snck-model', id);
    set({ selectedModelId: id });
  },

  setAvailableModels: (models) =>
    set({ availableModels: models, modelsLoaded: true }),
}));
