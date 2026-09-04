export type ProviderType =
  | 'OPENAI_COMPATIBLE'
  | 'ANTHROPIC'
  | 'GEMINI'
  | 'OPENROUTER'
  | 'CUSTOM';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderConnectionConfig {
  baseUrl?: string;
  apiKey: string;
}

export interface StreamChunk {
  delta?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ChatStreamParams {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export type TestStatus = 'CONNECTED' | 'INVALID_KEY' | 'PROVIDER_ERROR' | 'NETWORK_ERROR';

export interface TestResult {
  ok: boolean;
  status: TestStatus;
  message: string;
}

export interface ModelDefinition {
  identifier: string;
  displayName: string;
}

export interface ProviderAdapter {
  type: ProviderType;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModels: ModelDefinition[];
  chatStream(config: ProviderConnectionConfig, params: ChatStreamParams): AsyncGenerator<StreamChunk>;
  testConnection(config: ProviderConnectionConfig): Promise<TestResult>;
  fetchModels(config: ProviderConnectionConfig): Promise<ModelDefinition[]>;
}

export class ProviderError extends Error {
  status: 'INVALID_KEY' | 'PROVIDER_ERROR' | 'NETWORK_ERROR';
  httpStatus?: number;
  constructor(status: 'INVALID_KEY' | 'PROVIDER_ERROR' | 'NETWORK_ERROR', message: string, httpStatus?: number) {
    super(message);
    this.status = status;
    this.httpStatus = httpStatus;
  }
}
