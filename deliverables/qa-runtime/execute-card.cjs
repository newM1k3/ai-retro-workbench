var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/execute-card.ts
var execute_card_exports = {};
__export(execute_card_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(execute_card_exports);
var config = {
  path: "/api/execute-card",
  maxDuration: 26
};
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400"
};
var UPSTREAM_TIMEOUT_MS = 2e4;
function readEnv() {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    ZAI_API_KEY: process.env.ZAI_API_KEY ?? "",
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.4",
    ZAI_MODEL: process.env.ZAI_MODEL ?? "glm-5.2",
    MOCK_AI: (process.env.MOCK_AI ?? "false").toLowerCase() === "true",
    ALLOW_MOCK_FALLBACK: (process.env.ALLOW_MOCK_FALLBACK ?? "true").toLowerCase() === "true"
  };
}
var enc = (event, data) => `event: ${event}
data: ${JSON.stringify(data)}

`;
function sseResponse(stream) {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...CORS_HEADERS
    }
  });
}
function jsonError(status, code, model, message, retryable) {
  return new Response(JSON.stringify({ error: { code, model, message, retryable } }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}
var estimateTokens = (text) => Math.max(1, Math.ceil(text.length / 4));
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function* sseLines(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf("\n\n");
      while (idx >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        yield raw;
        idx = buf.indexOf("\n\n");
      }
    }
    if (buf.length) yield buf;
  } finally {
    reader.releaseLock();
  }
}
function parseSseBlock(raw) {
  let event = "message";
  const dataLines = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}
var UpstreamError = class extends Error {
  code;
  retryable;
  constructor(code, message, retryable) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
};
function pickProvider(slug, env) {
  if (slug === "claude")
    return {
      slug,
      display: "CLAUDE",
      core: "CORE-A",
      key: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      keyEnvName: "ANTHROPIC_API_KEY"
    };
  if (slug === "gpt")
    return {
      slug,
      display: "GPT-5.4",
      core: "CORE-B",
      key: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      keyEnvName: "OPENAI_API_KEY"
    };
  return {
    slug,
    display: "GLM-5.2",
    core: "CORE-C",
    key: env.ZAI_API_KEY,
    model: env.ZAI_MODEL,
    keyEnvName: "ZAI_API_KEY"
  };
}
async function upstreamRequest(provider, job) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    let url;
    let headers;
    let body;
    if (provider.slug === "claude") {
      url = "https://api.anthropic.com/v1/messages";
      headers = {
        "content-type": "application/json",
        "x-api-key": provider.key,
        "anthropic-version": "2023-06-01"
      };
      body = {
        model: provider.model,
        max_tokens: job.max_tokens ?? 1024,
        system: job.system_prompt ?? void 0,
        temperature: job.temperature ?? 0.4,
        stream: true,
        messages: [{ role: "user", content: job.prompt }]
      };
    } else {
      const base = provider.slug === "gpt" ? "https://api.openai.com/v1/chat/completions" : "https://api.z.ai/api/paas/v4/chat/completions";
      url = base;
      headers = {
        "content-type": "application/json",
        authorization: `Bearer ${provider.key}`
      };
      body = {
        model: provider.model,
        max_tokens: job.max_tokens ?? 1024,
        temperature: job.temperature ?? 0.4,
        stream: true,
        messages: [
          ...job.system_prompt ? [{ role: "system", content: job.system_prompt }] : [],
          { role: "user", content: job.prompt }
        ]
      };
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
      }
      if (res.status === 401 || res.status === 403)
        throw new UpstreamError("UPSTREAM_401", `AUTH REJECTED (HTTP ${res.status}) ${detail}`, false);
      if (res.status === 429)
        throw new UpstreamError("UPSTREAM_429", `RATE LIMITED (HTTP 429) ${detail}`, true);
      if (res.status >= 500)
        throw new UpstreamError("UPSTREAM_5xx", `UPSTREAM ERROR (HTTP ${res.status}) ${detail}`, true);
      throw new UpstreamError("INTERNAL", `UPSTREAM ERROR (HTTP ${res.status}) ${detail}`, true);
    }
    if (!res.body) throw new UpstreamError("STREAM_BROKEN", "EMPTY UPSTREAM BODY", true);
    return { body: res.body, contentType: res.headers.get("content-type") ?? "" };
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    if (controller.signal.aborted)
      throw new UpstreamError("UPSTREAM_TIMEOUT", "UPSTREAM TIMEOUT AFTER 20S", true);
    throw new UpstreamError("INTERNAL", `FETCH FAILED: ${e.message}`, true);
  } finally {
    clearTimeout(timer);
  }
}
async function* transformStream(provider, upstream, job) {
  let usageTokens;
  try {
    for await (const raw of sseLines(upstream)) {
      const evt = parseSseBlock(raw);
      if (!evt) continue;
      if (provider.slug === "claude") {
        if (evt.event === "error") {
          let msg = "ANTHROPIC ERROR";
          try {
            const j = JSON.parse(evt.data);
            msg = j.error?.message ?? j.error?.type ?? msg;
          } catch {
          }
          throw new UpstreamError("UPSTREAM_5xx", msg, true);
        }
        if (evt.event === "content_block_delta") {
          const j = JSON.parse(evt.data);
          if (j.delta?.type === "text_delta" && j.delta.text) yield enc("delta", j.delta.text);
        } else if (evt.event === "message_delta") {
          const j = JSON.parse(evt.data);
          if (j.delta?.usage?.output_tokens != null) usageTokens = j.delta.usage.output_tokens;
        }
      } else {
        if (evt.data.trim() === "[DONE]") break;
        const j = JSON.parse(evt.data);
        if (j.usage?.completion_tokens != null) usageTokens = j.usage.completion_tokens;
        const piece = j.choices?.[0]?.delta?.content;
        if (piece) yield enc("delta", piece);
      }
    }
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError("STREAM_BROKEN", `STREAM PARSE ERROR: ${e.message}`, true);
  }
  const tokens = usageTokens ?? estimateTokens(job.prompt);
  yield enc("done", { tokens });
}
async function* mockStream(provider, job) {
  const head = job.prompt.slice(0, 90);
  const parts = [
    `> RETRO CORE TRANSMISSION // ${provider.core} // ${provider.display}
`,
    `> PROMPT RECEIVED: "${head}${job.prompt.length > 90 ? "\u2026" : ""}"
`,
    `>
`,
    `> [MOCK] NO LIVE CORING KEY CONFIGURED FOR ${provider.display}.
`,
    `> FALLBACK CIRCUIT ENGAGED \u2014 CANNED TELEMETRY IN 8-10 BURSTS.
`,
    `> SET ${provider.keyEnvName} IN NETLIFY ENV TO ROUTE REAL PUNCHED TEXT.
`,
    `> CYCLE PROTOCOL: FEED \u2192 CORE \u2192 OUTPUT. REPEAT. STAY ON TARGET.
`,
    `> FLUX CAPACITOR NOMINAL. HOPPER PRESSURE NOMINAL. DECK INTEGRITY NOMINAL.
`,
    `> END OF MOCK TRANSMISSION. REAL UNIT AWAITED.
`
  ];
  yield enc("meta", {
    model: provider.model,
    core: provider.core,
    mock: true,
    started_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  for (const p of parts) {
    yield enc("delta", p);
    await sleep(150);
  }
  await sleep(150);
  yield enc("done", { tokens: estimateTokens(job.prompt) + 220 });
}
async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonError(405, "BAD_REQUEST", "", "METHOD NOT ALLOWED", false);
  }
  let job;
  try {
    job = await req.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "", "INVALID JSON BODY", false);
  }
  if (typeof job.prompt !== "string" || job.prompt.trim().length === 0) {
    return jsonError(400, "BAD_REQUEST", "", "PROMPT REQUIRED", false);
  }
  if (job.target_model !== "claude" && job.target_model !== "gpt" && job.target_model !== "glm") {
    return jsonError(400, "BAD_REQUEST", "", "target_model MUST BE claude | gpt | glm", false);
  }
  const env = readEnv();
  const provider = pickProvider(job.target_model, env);
  if (!provider) {
    return jsonError(400, "BAD_REQUEST", job.target_model, "UNKNOWN MODEL SLUG", false);
  }
  const forceMock = env.MOCK_AI;
  const needKey = !provider.key;
  if (needKey && !env.ALLOW_MOCK_FALLBACK) {
    return jsonError(
      503,
      "MODEL_NOT_CONFIGURED",
      provider.model,
      `${provider.keyEnvName} NOT SET AND ALLOW_MOCK_FALLBACK=FALSE`,
      false
    );
  }
  const upstream = forceMock || needKey ? null : await upstreamRequest(provider, job);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk) => controller.enqueue(new TextEncoder().encode(chunk));
      try {
        const meta = {
          model: provider.model,
          core: provider.core,
          mock: forceMock || needKey,
          started_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        send(enc("meta", meta));
        if (upstream) {
          for await (const chunk of transformStream(provider, upstream.body, job)) send(chunk);
        } else {
          for await (const chunk of mockStream(provider, job)) send(chunk);
        }
      } catch (e) {
        const err = e instanceof UpstreamError ? e : new UpstreamError("INTERNAL", e.message, true);
        send(
          enc("error", {
            code: err.code,
            model: provider.model,
            message: err.message,
            retryable: err.retryable
          })
        );
      } finally {
        controller.close();
      }
    }
  });
  return sseResponse(stream);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
