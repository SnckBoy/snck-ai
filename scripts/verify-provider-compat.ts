/**
 * Compatibility check for the OpenAI-compatible adapter against a strict
 * third-party inference server that rejects optional parameters:
 *   - rejects `stream_options`
 *   - rejects `max_tokens` (requires `max_completion_tokens`)
 *
 * A correct adapter should transparently fall back and still stream a reply.
 *
 * Run with:  npx tsx scripts/verify-provider-compat.ts
 */
import http from 'node:http';
import { openaiCompatibleAdapter } from '../src/lib/providers/openai-compatible';

function sse(res: http.ServerResponse, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'strict-model' }] }));
    return;
  }

  if (req.method === 'POST' && req.url === '/chat/completions') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');

    const reject = (message: string) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message } }));
    };

    if ('stream_options' in body) return reject('Unsupported parameter: stream_options');
    if ('max_tokens' in body && !('max_completion_tokens' in body)) {
      return reject("Unsupported parameter: max_tokens. Use 'max_completion_tokens' instead.");
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    for (const piece of ['Hello', ' from', ' strict', ' provider']) {
      sse(res, { choices: [{ delta: { content: piece } }] });
    }
    sse(res, { choices: [{ delta: {}, finish_reason: 'stop' }] });
    sse(res, { choices: [], usage: { prompt_tokens: 7, completion_tokens: 4 } });
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

async function main() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let text = '';
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  try {
    const generator = openaiCompatibleAdapter.chatStream(
      { baseUrl, apiKey: 'strict-test-key' },
      {
        model: 'strict-model',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 128,
      },
    );
    for await (const chunk of generator) {
      if (chunk.delta) text += chunk.delta;
      if (chunk.usage) usage = chunk.usage;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const expected = 'Hello from strict provider';
  if (text !== expected) {
    console.error(`FAIL: expected "${expected}" but got "${text}"`);
    process.exit(1);
  }
  if (!usage || usage.outputTokens <= 0) {
    console.error('FAIL: expected usage to be reported');
    process.exit(1);
  }
  console.log('PASS: strict third-party provider streamed successfully:', JSON.stringify({ text, usage }));
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
