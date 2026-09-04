import type { ProviderAdapter, ProviderType, TestResult } from './types';
import { openaiCompatibleAdapter } from './openai-compatible';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { openrouterAdapter } from './openrouter';

export * from './types';
export { estimateTokens } from './stream';

const adapters: Record<ProviderType, ProviderAdapter> = {
  OPENAI_COMPATIBLE: openaiCompatibleAdapter,
  ANTHROPIC: anthropicAdapter,
  GEMINI: geminiAdapter,
  OPENROUTER: openrouterAdapter,
  CUSTOM: openaiCompatibleAdapter,
};

export function getAdapter(type: ProviderType): ProviderAdapter {
  const adapter = adapters[type];
  if (!adapter) throw new Error(`Unsupported provider type: ${type}`);
  return adapter;
}

export function listAdapterTypes(): Array<{ type: ProviderType; label: string; description: string; defaultBaseUrl: string }> {
  return Object.values(adapters).map((a) => ({
    type: a.type,
    label: a.label,
    description: a.description,
    defaultBaseUrl: a.defaultBaseUrl,
  }));
}

export function getDefaultModels(type: ProviderType) {
  return getAdapter(type).defaultModels;
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'CONNECTED':
      return 'Connected';
    case 'INVALID_KEY':
      return 'Invalid API Key';
    case 'PROVIDER_ERROR':
      return 'Provider Error';
    case 'NETWORK_ERROR':
      return 'Network Error';
    case 'DISABLED':
      return 'Disabled';
    default:
      return 'Untested';
  }
}

export type { ProviderAdapter, ProviderType, TestResult };
