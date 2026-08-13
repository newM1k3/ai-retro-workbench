// Netlify v2 function: /api/execute-card
// Mock-first execution. SSE stream: meta → delta* → done | error.
// Keys are read ONLY from process.env. MOCK_AI / ALLOW_MOCK_FALLBACK control
// canned retro-flavored replies when keys are missing.

export const config = {
  path: '/api/execute-card',
  maxDuration: 26,
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

const UPSTREAM_TIMEOUT_MS = 20_000;

type ModelSlug = 'claude' | 'gpt' | 'glm';

interface JobRequest {
  prompt: string;
  target_model: ModelSlug;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface Env {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  ZAI_API_KEY: string;
  ANTHROPIC_MODEL: string;
  OPENAI_MODEL: string;
  ZAI_MODEL: string;
  MOCK_AI: boolean;
  ALLOW_MOCK_FALLBACK: boolean;
}

// ---- env reads isolated here (server-only, never exposed to the client) ----
function readEnv(): Env {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    ZAI_API_KEY: process.env.ZAI_API_KEY ?? '',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-5.4',
    ZAI_MODEL: process.env.ZAI_MODEL ?? 'glm-5.2',
    MOCK_AI: (process.env.MOCK_AI ?? 'false').toLowerCase() === 'true',
    ALLOW_MOCK_FALLBACK: (process.env.ALLOW_MOCK_FALLBACK ?? 'true').toLowerCase() === 'true',
  };
}

// ---- SSE helpers ----
const enc = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    },
  });
}

function jsonError(status: number, code: string, model: string, message: string, retryable: boolean): Response {
  return new Response(JSON.stringify({ error: { code, model, message, retryable } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---- upstream SSE line parser ----
async function* sseLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf('\n\n');
      while (idx >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        yield raw;
        idx = buf.indexOf('\n\n');
      }
    }
    if (buf.length) yield buf;
  } finally {
    reader.releaseLock();
  }
}

function parseSseBlock(raw: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

class UpstreamError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

// ---- provider adapters ----
interface Provider {
  slug: ModelSlug;
  display: string;
  core: string;
  key: string;
  model: string;
  keyEnvName: string;
}

function pickProvider(slug: ModelSlug, env: Env): Provider | null {
  if (slug === 'claude')
    return {
      slug,
      display: 'CLAUDE',
      core: 'CORE-A',
      key: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      keyEnvName: 'ANTHROPIC_API_KEY',
    };
  if (slug === 'gpt')
    return {
      slug,
      display: 'GPT-5.4',
      core: 'CORE-B',
      key: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      keyEnvName: 'OPENAI_API_KEY',
    };
  return {
    slug,
    display: 'GLM-5.2',
    core: 'CORE-C',
    key: env.ZAI_API_KEY,
    model: env.ZAI_MODEL,
    keyEnvName: 'ZAI_API_KEY',
  };
}

async function upstreamRequest(
  provider: Provider,
  job: JobRequest,
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, unknown>;
    if (provider.slug === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'content-type': 'application/json',
        'x-api-key': provider.key,
        'anthropic-version': '2023-06-01',
      };
      body = {
        model: provider.model,
        max_tokens: job.max_tokens ?? 1024,
        system: job.system_prompt ?? undefined,
        temperature: job.temperature ?? 0.4,
        stream: true,
        messages: [{ role: 'user', content: job.prompt }],
      };
    } else {
      const base =
        provider.slug === 'gpt'
          ? 'https://api.openai.com/v1/chat/completions'
          : 'https://api.z.ai/api/paas/v4/chat/completions';
      url = base;
      headers = {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.key}`,
      };
      body = {
        model: provider.model,
        max_tokens: job.max_tokens ?? 1024,
        temperature: job.temperature ?? 0.4,
        stream: true,
        messages: [
          ...(job.system_prompt ? [{ role: 'system', content: job.system_prompt }] : []),
          { role: 'user', content: job.prompt },
        ],
      };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        // ignore body read failure
      }
      if (res.status === 401 || res.status === 403)
        throw new UpstreamError('UPSTREAM_401', `AUTH REJECTED (HTTP ${res.status}) ${detail}`, false);
      if (res.status === 429)
        throw new UpstreamError('UPSTREAM_429', `RATE LIMITED (HTTP 429) ${detail}`, true);
      if (res.status >= 500)
        throw new UpstreamError('UPSTREAM_5xx', `UPSTREAM ERROR (HTTP ${res.status}) ${detail}`, true);
      throw new UpstreamError('INTERNAL', `UPSTREAM ERROR (HTTP ${res.status}) ${detail}`, true);
    }
    if (!res.body) throw new UpstreamError('STREAM_BROKEN', 'EMPTY UPSTREAM BODY', true);
    return { body: res.body, contentType: res.headers.get('content-type') ?? '' };
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    if (controller.signal.aborted)
      throw new UpstreamError('UPSTREAM_TIMEOUT', 'UPSTREAM TIMEOUT AFTER 20S', true);
    throw new UpstreamError('INTERNAL', `FETCH FAILED: ${(e as Error).message}`, true);
  } finally {
    clearTimeout(timer);
  }
}

// Transform upstream SSE → our SSE protocol (meta/delta/done/error).
async function* transformStream(
  provider: Provider,
  upstream: ReadableStream<Uint8Array>,
  job: JobRequest,
): AsyncGenerator<string> {
  let usageTokens: number | undefined;
  try {
    for await (const raw of sseLines(upstream)) {
      const evt = parseSseBlock(raw);
      if (!evt) continue;
      if (provider.slug === 'claude') {
        if (evt.event === 'error') {
          let msg = 'ANTHROPIC ERROR';
          try {
            const j = JSON.parse(evt.data) as { error?: { message?: string; type?: string } };
            msg = j.error?.message ?? j.error?.type ?? msg;
          } catch {
            // keep default
          }
          throw new UpstreamError('UPSTREAM_5xx', msg, true);
        }
        if (evt.event === 'content_block_delta') {
          const j = JSON.parse(evt.data) as { delta?: { type?: string; text?: string } };
          if (j.delta?.type === 'text_delta' && j.delta.text) yield enc('delta', j.delta.text);
        } else if (evt.event === 'message_delta') {
          const j = JSON.parse(evt.data) as { delta?: { usage?: { output_tokens?: number } } };
          if (j.delta?.usage?.output_tokens != null) usageTokens = j.delta.usage.output_tokens;
        }
      } else {
        if (evt.data.trim() === '[DONE]') break;
        const j = JSON.parse(evt.data) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
          usage?: { completion_tokens?: number };
        };
        if (j.usage?.completion_tokens != null) usageTokens = j.usage.completion_tokens;
        const piece = j.choices?.[0]?.delta?.content;
        if (piece) yield enc('delta', piece);
      }
    }
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError('STREAM_BROKEN', `STREAM PARSE ERROR: ${(e as Error).message}`, true);
  }
  const tokens = usageTokens ?? estimateTokens(job.prompt);
  yield enc('done', { tokens });
}

// ---- mock provider (canned retro-flavored reply, ~8-10 deltas, 150ms apart) ----
async function* mockStream(provider: Provider, job: JobRequest): AsyncGenerator<string> {
  const head = job.prompt.slice(0, 90);
  const parts = [
    `> RETRO CORE TRANSMISSION // ${provider.core} // ${provider.display}\n`,
    `> PROMPT RECEIVED: "${head}${job.prompt.length > 90 ? '…' : ''}"\n`,
    `>\n`,
    `> [MOCK] NO LIVE CORING KEY CONFIGURED FOR ${provider.display}.\n`,
    `> FALLBACK CIRCUIT ENGAGED — CANNED TELEMETRY IN 8-10 BURSTS.\n`,
    `> SET ${provider.keyEnvName} IN NETLIFY ENV TO ROUTE REAL PUNCHED TEXT.\n`,
    `> CYCLE PROTOCOL: FEED → CORE → OUTPUT. REPEAT. STAY ON TARGET.\n`,
    `> FLUX CAPACITOR NOMINAL. HOPPER PRESSURE NOMINAL. DECK INTEGRITY NOMINAL.\n`,
    `> END OF MOCK TRANSMISSION. REAL UNIT AWAITED.\n`,
  ];
  for (const p of parts) {
    yield enc('delta', p);
    await sleep(150);
  }
  await sleep(150);
  yield enc('done', { tokens: estimateTokens(job.prompt) + 220 });
}

// ---- handler ----
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', '', 'METHOD NOT ALLOWED', false);
  }

  let job: JobRequest;
  try {
    job = (await req.json()) as JobRequest;
  } catch {
    return jsonError(400, 'BAD_REQUEST', '', 'INVALID JSON BODY', false);
  }

  if (typeof job.prompt !== 'string' || job.prompt.trim().length === 0) {
    return jsonError(400, 'BAD_REQUEST', '', 'PROMPT REQUIRED', false);
  }
  if (job.target_model !== 'claude' && job.target_model !== 'gpt' && job.target_model !== 'glm') {
    return jsonError(400, 'BAD_REQUEST', '', 'target_model MUST BE claude | gpt | glm', false);
  }

  const env = readEnv();
  const provider = pickProvider(job.target_model, env);
  if (!provider) {
    return jsonError(400, 'BAD_REQUEST', job.target_model, 'UNKNOWN MODEL SLUG', false);
  }

  const forceMock = env.MOCK_AI;
  const needKey = !provider.key;
  if (needKey && !env.ALLOW_MOCK_FALLBACK) {
    return jsonError(
      503,
      'MODEL_NOT_CONFIGURED',
      provider.model,
      `${provider.keyEnvName} NOT SET AND ALLOW_MOCK_FALLBACK=FALSE`,
      false,
    );
  }

  // Fatal error before the SSE stream starts → JSON error envelope, never a raw 500.
  let upstream: { body: ReadableStream<Uint8Array>; contentType: string } | null = null;
  if (!forceMock && !needKey) {
    try {
      upstream = await upstreamRequest(provider, job);
    } catch (e) {
      const err =
        e instanceof UpstreamError ? e : new UpstreamError('INTERNAL', (e as Error).message, true);
      return jsonError(502, err.code, provider.model, err.message, err.retryable);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string): void => controller.enqueue(new TextEncoder().encode(chunk));
      try {
        const meta = {
          model: provider.model,
          core: provider.core,
          mock: forceMock || needKey,
          started_at: new Date().toISOString(),
        };
        send(enc('meta', meta));
        if (upstream) {
          for await (const chunk of transformStream(provider, upstream.body, job)) send(chunk);
        } else {
          for await (const chunk of mockStream(provider, job)) send(chunk);
        }
      } catch (e) {
        const err =
          e instanceof UpstreamError ? e : new UpstreamError('INTERNAL', (e as Error).message, true);
        send(
          enc('error', {
            code: err.code,
            model: provider.model,
            message: err.message,
            retryable: err.retryable,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
