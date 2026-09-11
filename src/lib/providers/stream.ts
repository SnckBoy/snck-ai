import { ProviderError } from './types';

/**
 * Parse an SSE (Server-Sent Events) response body into parsed JSON objects
 * for each `data:` line. Ignores comments, `event:` lines and `[DONE]`.
 */
export async function* sseJsonIterator(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushLine = (line: string) => {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      return JSON.parse(payload);
    } catch {
      return undefined;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalize CRLF so both `\n\n` and `\r\n\r\n` delimiters are handled.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = flushLine(chunk);
        if (parsed !== undefined) yield parsed;
        boundary = buffer.indexOf('\n\n');
      }
    }

    // Flush any trailing data without a closing double newline.
    if (buffer.trim().length > 0) {
      const parsed = flushLine(buffer);
      if (parsed !== undefined) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Naive token estimation used as a fallback when a provider does not report
 * usage. ~4 characters per token for mixed text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const json = await res.json();
    const raw =
      json?.error?.message ??
      json?.message ??
      json?.detail ??
      json?.error ??
      JSON.stringify(json);
    return typeof raw === 'string' ? raw.slice(0, 300) : JSON.stringify(raw).slice(0, 300);
  } catch {
    const text = await res.text();
    return (text || res.statusText || 'Unknown error').slice(0, 300);
  }
}

export function mapHttpError(status: number, message: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('INVALID_KEY', `Invalid API key (HTTP ${status})${message ? `: ${message}` : ''}`, status);
  }
  return new ProviderError('PROVIDER_ERROR', `Provider returned HTTP ${status}${message ? `: ${message}` : ''}`, status);
}
