export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  modelId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview?: string;
}

export interface ModelOption {
  id: string;
  identifier: string;
  displayName: string;
  providerId: string;
  providerName: string;
  providerType: string;
}
