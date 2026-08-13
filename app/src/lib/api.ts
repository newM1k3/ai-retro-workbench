// Frontend SSE client for /api/execute-card.
// Minimal parser: buffer on \n\n, read `data:` lines. One network call per execution.

import type { ChannelSlug } from './types';

export interface ExecuteMeta {
  model: string;
  core?: string;
  mock?: boolean;
  started_at?: string;
}

export interface ExecuteErrorInfo {
  code: string;
  model?: string;
  message: string;
  retryable: boolean;
}

export interface ExecuteDoneInfo {
  output: string;
  tokens: number;
}

export interface ExecuteOptions {
  prompt: string;
  targetModel: ChannelSlug;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  onMeta?: (meta: ExecuteMeta) => void;
  onDelta?: (text: string) => void;
  onDone?: (info: ExecuteDoneInfo) => void;
  onError?: (err: ExecuteErrorInfo) => void;
}

/** Client-side hard cap (ms). Backend maxDuration is 26s; we stop at 25s. */
const CLIENT_CAP_MS = 25_000;

interface ParsedSse {
  event: string;
  data: string;
}

function parseSseBlock(raw: string): ParsedSse | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function executeCard(opts: ExecuteOptions): () => void {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CLIENT_CAP_MS);
  let settled = false;

  const settle = (fn?: () => void): void => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    fn?.();
  };

  const fail = (err: ExecuteErrorInfo): void => settle(() => opts.onError?.(err));

  void (async () => {
    let res: Response;
    try {
      res = await fetch('/api/execute-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          prompt: opts.prompt,
          target_model: opts.targetModel,
          system_prompt: opts.systemPrompt,
          temperature: opts.temperature,
          max_tokens: opts.maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        fail({ code: 'UPSTREAM_TIMEOUT', message: 'CLIENT CAP 25S REACHED.', retryable: true });
      } else {
        fail({ code: 'STREAM_BROKEN', message: 'CONNECTION LOST.', retryable: true });
      }
      return;
    }

    if (!res.ok || !res.body) {
      try {
        const json = (await res.json()) as { error?: ExecuteErrorInfo };
        if (json.error) fail(json.error);
        else fail({ code: 'INTERNAL', message: `HTTP ${res.status}`, retryable: true });
      } catch {
        fail({ code: 'INTERNAL', message: `HTTP ${res.status}`, retryable: true });
      }
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let output = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf('\n\n');
        while (idx >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const evt = parseSseBlock(raw);
          if (evt) {
            try {
              if (evt.event === 'meta') {
                opts.onMeta?.(JSON.parse(evt.data) as ExecuteMeta);
              } else if (evt.event === 'delta') {
                const d = JSON.parse(evt.data) as string;
                if (typeof d === 'string' && d.length > 0) {
                  output += d;
                  opts.onDelta?.(d);
                }
              } else if (evt.event === 'done') {
                const d = JSON.parse(evt.data) as { tokens?: number };
                settle(() => opts.onDone?.({ output, tokens: d.tokens ?? estimateTokens(output) }));
              } else if (evt.event === 'error') {
                const d = JSON.parse(evt.data) as ExecuteErrorInfo;
                fail(d);
              }
            } catch {
              // malformed event — ignore, keep streaming
            }
          }
          idx = buf.indexOf('\n\n');
        }
      }
      // Stream ended without an explicit done event
      settle(() => opts.onDone?.({ output, tokens: estimateTokens(output) }));
    } catch {
      if (controller.signal.aborted) {
        fail({ code: 'UPSTREAM_TIMEOUT', message: 'CLIENT CAP 25S REACHED.', retryable: true });
      } else {
        fail({ code: 'STREAM_BROKEN', message: 'STREAM INTERRUPTED.', retryable: true });
      }
    }
  })();

  return () => controller.abort();
}
