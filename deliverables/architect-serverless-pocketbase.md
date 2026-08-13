# Retro AI Workbench — Serverless API + PocketBase Architecture

**Document:** Technical Architecture — Serverless & Data Layer
**Author:** The Architect
**Audience:** Dave (implementation) — build from this, zero spaghetti.
**Version:** 1.0 (2026-08-12)
**Status:** Blueprint — security/pricing review (parallel track) findings slot in at marked 🔌 integration points.

---

## 0. Scope & Conventions

This blueprint covers exactly two layers:

1. **Serverless API** — `netlify/functions/*` (execute-card + shared modules). All model keys live **server-side only**.
2. **PocketBase stub** — `src/lib/pocketbase.ts`, the `Prompts` collection, and the seed contract that "AI Data" must conform to for `default-cards.json`.

Canonical stack (strict, do not deviate): React 18 + Vite + TypeScript · Tailwind + Lucide React · Netlify static hosting + Netlify Serverless Functions · **PocketBase ONLY** (Supabase strictly forbidden). Deploy target: **MJW Personal App Platform**.

### Single source of truth: model slugs

Every layer (Switchboard toggles, function payload, PocketBase enum, seed file) uses **one lowercase slug vocabulary**. Display names are a UI concern only.

| Slug | Display name | Provider |
|------|-------------|----------|
| `claude` | Claude | Anthropic Messages API |
| `gpt` | GPT-4o | OpenAI Chat Completions API |
| `glm` | GLM-5.2 | Z.ai (OpenAI-compatible) |

> ⚠️ Seed/API/payloads must use `"claude" | "gpt" | "glm"` — **never** `"Claude"`, `"GPT-4o"`, etc.

---

## 1. System Overview

```
┌─────────────────────────── Browser (PWA) ───────────────────────────┐
│  Punch Card Bench ──▶ Switchboard (1 of 3 toggles) ──▶ Hopper (drop)│
│         │                                        │                 │
│         ▼                                        ▼                 │
│  src/lib/pocketbase.ts ◀── saved cards ──┐   src/lib/api.ts         │
└──────────┬───────────────────────────────┼──────────────────────────┘
           │ VITE_POCKETBASE_URL           │ POST /api/execute-card (SSE)
           ▼                               ▼
┌──────────────────────┐   ┌───────────────────────────────────────────┐
│ PocketBase (hosted)  │   │ Netlify Function: execute-card           │
│ collection: Prompts  │   │  └─ _shared/ (providers, env, stream,    │
└──────────────────────┘   │     errors, cors)                        │
                           │      │ routed by target_model             │
                           │      ▼                                    │
                           │  ┌──────────┬──────────┬──────────┐       │
                           │  │ Anthropic │ OpenAI   │ Z.ai     │       │
                           │  │ Claude    │ GPT-4o   │ GLM-5.2  │       │
                           │  └──────────┴──────────┴──────────┘       │
                           │  keys: server-side env / vault 🔌         │
                           └───────────────────────────────────────────┘
```

**Flow:** User drops a card in the Hopper → `executeCardStream()` (src/lib/api.ts) POSTs `{prompt, target_model, ...}` → function validates → resolves provider → streams SSE deltas back → CRT typewriter renders them. Saved cards round-trip through PocketBase; **keys never touch the client or PocketBase**.

---

## 2. SERVERLESS API BLUEPRINT

### 2.1 Folder structure (exact)

```
retro-ai-workbench/
├── netlify.toml
├── netlify/
│   └── functions/
│       ├── execute-card.ts          # single public endpoint (v2 streaming handler)
│       └── _shared/                 # never deployed as endpoints (underscore prefix)
│           ├── types.ts             # request/response/SSE event types
│           ├── env.ts               # ALL server-side env reads (key vault hook 🔌)
│           ├── providers.ts         # per-model registry + adapters
│           ├── stream.ts            # SSE encoder, abort-with-timeout helper, safe logging
│           ├── errors.ts            # structured error envelope + mapper + redaction
│           ├── validate.ts          # request body validation (hand-rolled, ~40 lines)
│           └── cors.ts              # CORS headers + OPTIONS preflight
├── src/
│   ├── lib/
│   │   ├── pocketbase.ts            # §3.3 — PocketBase client stub
│   │   └── api.ts                   # §2.11 — SSE client for execute-card
│   └── hooks/usePrompts.ts          # §3.4 — bench ↔ PocketBase
└── .env.example                     # §3.5
```

Rules for Dave:
- **Never** put logic in `execute-card.ts` beyond orchestration — one step per shared module.
- **Never** read `process.env.*` outside `_shared/env.ts` (this is the key-vault swap point).
- Functions use the **Netlify v2 handler style** (`export default async (req: Request) => Response`) — required for streaming responses.

### 2.2 Routing & configuration

**netlify.toml**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# Per-function settings (streaming + timeout ceiling).
# maxDuration: 10s is the platform default; 26s is the hard max.
# Stream time is NOT excluded from the clock — keep MVP streams short (§2.8).
[functions."execute-card"]
  maxDuration = 26
```

**Function route** — inside `execute-card.ts` (v2 style):

```ts
export const config = {
  path: "/api/execute-card",   // custom route; legacy /.netlify/functions/execute-card also works
  maxDuration: 26,
};
```

> Netlify v1-style `Handler` (APIGatewayProxyEvent) is **forbidden** for this function — it cannot return a streaming `Response`.

### 2.3 Server-side env (never VITE_-prefixed, never bundled to client)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | if using Claude | Anthropic key |
| `OPENAI_API_KEY` | if using GPT | OpenAI key |
| `ZAI_API_KEY` | if using GLM | Z.ai key |
| `ANTHROPIC_MODEL` | no (default `claude-sonnet-4-5`) | model ID override |
| `OPENAI_MODEL` | no (default `gpt-4o`) | model ID override |
| `ZAI_MODEL` | no (default `glm-5.2`) | model ID override |
| `MOCK_AI` | no (`false`) | force mock mode even with keys (dev/demo) |
| `ALLOW_MOCK_FALLBACK` | no (`true`) | auto-mock when a model's key is absent |
| `MAX_PROMPT_CHARS` | no (`32000`) | prompt length guard / truncation ceiling |
| `CORS_ORIGIN` | no (`*`) | allowed origin(s), comma-separated (tighten per 🔌 IP-5) |

### 2.4 Request contract (frontend → function)

`POST /api/execute-card` · `Content-Type: application/json` · `Accept: text/event-stream`

```ts
// netlify/functions/_shared/types.ts
export type TargetModel = "claude" | "gpt" | "glm";

export interface ExecuteCardRequest {
  prompt: string;            // REQUIRED — the punch card text (1..MAX_PROMPT_CHARS)
  target_model: TargetModel; // REQUIRED — slug, validated against enum
  system_prompt?: string;    // optional — card-level system prompt
  temperature?: number;      // optional, default 0.7, clamp 0..1
  max_tokens?: number;       // optional, default 512, clamp 1..4096
  stream?: boolean;          // optional, default true (SSE). false → buffered JSON
}
```

Validation (`_shared/validate.ts`) returns `BAD_REQUEST` with a field-level `issues[]` on failure. No extra fields are accepted (strip unknown keys).

### 2.5 Response contract

#### A. Streaming (default) — Server-Sent Events over the HTTP response

Each event is `event: <name>\ndata: <json>\n\n` (standard SSE framing, LF line endings).

```
event: meta
data: {"type":"meta","run_id":"r_9f2c","model":"claude","mock":false,"started_at":"2026-08-12T23:58:00.000Z"}

event: delta
data: {"type":"delta","text":"The 1980s called"}

event: delta
data: {"type":"delta","text":", and they want their terminal back."}

event: usage
data: {"type":"usage","input_tokens":42,"output_tokens":17}

event: done
data: {"type":"done","run_id":"r_9f2c"}
```

Event schema (`types.ts`):

```ts
export type SseEvent =
  | { type: "meta"; run_id: string; model: TargetModel; mock: boolean; started_at: string }
  | { type: "delta"; text: string }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "done"; run_id: string }
  | { type: "error"; code: ErrorCode; model: TargetModel | null; message: string; retryable: boolean };
```

Rules: `meta` is always first. `delta` events may repeat (empty `delta` may be skipped). Exactly one terminal event: `done` **or** `error`. CRT rule: render `delta.text` verbatim, typewriter-paced client-side; on `error`, render the red CRT error block from `message` + `code`.

#### B. Non-streaming JSON (stream:false, or fatal error before stream starts)

HTTP status mirrors the problem; body is the error envelope:

```ts
export interface ErrorEnvelope {
  error: {
    code: ErrorCode;             // see §2.9
    model: TargetModel | null;
    message: string;             // human-readable, CRT-safe (already redacted)
    retryable: boolean;
  };
}
```

Example — key not configured: `400 {"error":{"code":"MODEL_NOT_CONFIGURED","model":"gpt","message":"GPT-4o is not wired up yet. Flip to SIMULATION mode or configure the key.","retryable":false}}`

### 2.6 execute-card.ts — orchestration skeleton (build to this shape)

```ts
import { corsHeaders, preflight } from "./_shared/cors";
import { validateRequest } from "./_shared/validate";
import { getApiKey, isMockForced, mockAllowed } from "./_shared/env";
import { getProvider } from "./_shared/providers";
import { sseHeaders, sseFromAsyncIterable } from "./_shared/stream";
import { errorEnvelope, badRequest } from "./_shared/errors";
import type { ExecuteCardRequest } from "./_shared/types";

export const config = { path: "/api/execute-card", maxDuration: 26 };

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflight();

  if (req.method !== "POST") {
    return errorEnvelope(405, { code: "BAD_REQUEST", message: "POST only." });
  }

  // STEP 1 — parse + validate ------------------------------------------------
  const parsed = validateRequest(await req.text().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.issues);
  const body: ExecuteCardRequest = parsed.value;

  // STEP 2 — pre-flight guard (🔌 IP-2: budget / rate-limit / truncation hooks)
  if (body.prompt.length > MAX_PROMPT_CHARS) return badRequest([{ field: "prompt", issue: "too_long" }]);
  // 🔌 IP-2 — insert: cost guard (per-model cap), rate limiter, quota check. Return 429 envelope if tripped.

  // STEP 3 — provider + key resolution (🔌 IP-1: key vault lives in env.ts)
  const provider = getProvider(body.target_model);
  const apiKey = getApiKey(body.target_model);
  const mock = isMockForced() || (mockAllowed() && !apiKey);

  if (!apiKey && !mock) {
    return errorEnvelope(400, {
      code: "MODEL_NOT_CONFIGURED", model: body.target_model,
      message: `${provider.displayName} is not wired up yet.`, retryable: false,
    });
  }

  // STEP 4 — stream (SSE) or buffered JSON -----------------------------------
  if (body.stream !== false) {
    const events = sseFromAsyncIterable(
      mock
        ? provider.mockStream(body)                     // canned demo stream (§2.8)
        : provider.stream(body, apiKey!, req.signal),   // upstream SSE passthrough
      body.target_model,
    );
    return new Response(events, { headers: sseHeaders() });
  }

  // Buffered fallback: collect all deltas, return JSON { text, usage, model }
  const chunks: string[] = [];
  const it = mock ? provider.mockStream(body) : provider.stream(body, apiKey!, req.signal);
  for await (const ev of it) if (ev.type === "delta") chunks.push(ev.text);
  return new Response(JSON.stringify({ model: body.target_model, text: chunks.join("") }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
};
```

### 2.7 Per-model routing — provider registry (`_shared/providers.ts`)

```ts
export interface ProviderStreamEvent {
  type: "delta" | "usage";
  text?: string;
  input_tokens?: number;
  output_tokens?: number;
}

export interface Provider {
  slug: TargetModel;
  displayName: string;
  stream(body: ExecuteCardRequest, apiKey: string, signal: AbortSignal): AsyncIterable<ProviderStreamEvent>;
  mockStream(body: ExecuteCardRequest): AsyncIterable<ProviderStreamEvent>;
}

export const PROVIDERS: Record<TargetModel, Provider> = {
  claude: anthropicProvider,
  gpt: openaiProvider,
  glm: zaiProvider,
};
export const getProvider = (slug: TargetModel) => PROVIDERS[slug];
```

**Claude (Anthropic)**
- `POST https://api.anthropic.com/v1/messages`
- Headers: `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Body: `{ model, max_tokens, stream: true, system?: string, messages: [{ role: "user", content: prompt }] }`
- Parse SSE: `content_block_delta` (`.delta.text` → `delta`), `message_delta` (`.usage.output_tokens` → `usage`).

**GPT-4o (OpenAI)**
- `POST https://api.openai.com/v1/chat/completions`
- Headers: `Authorization: Bearer <key>`, `content-type: application/json`
- Body: `{ model: "gpt-4o", stream: true, stream_options: { include_usage: true }, temperature, max_tokens, messages: [{ role: "system", content: system_prompt }, { role: "user", content: prompt }] }`
- Parse SSE: `choices[0].delta.content` (may be `null`) → `delta`; `usage` on final chunk.

**GLM-5.2 (Z.ai)** — OpenAI-compatible
- `POST https://api.z.ai/api/paas/v4/chat/completions`
- Headers: `Authorization: Bearer <key>`, `content-type: application/json`
- Body: identical shape to OpenAI; parse identically.

Shared adapter skeleton (all three implement this; differences are URL/headers/SSE-field mapping):

```ts
function upstreamSseFetch(url: string, init: RequestInit): AsyncIterable<ProviderStreamEvent> {
  // fetch with AbortSignal (chained client signal + 20s upstream timeout, see §2.8)
  // parse upstream SSE lines; map to ProviderStreamEvent; throw UpstreamError on non-2xx
}
```

Rule: **no provider-specific code may live in execute-card.ts** — only in its adapter. Adding a 4th model = new adapter + registry entry + env key + PocketBase enum value.

### 2.8 Streaming design & Netlify constraints

**Mechanism:** Netlify Functions support streaming responses via v2 handlers returning `new Response(readableStream, ...)`. The function wraps the upstream SSE stream, re-encodes it as our canonical event set (`_shared/stream.ts`), and flushes chunks as they arrive. Headers:

```ts
export const sseHeaders = () => ({
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
  "x-accel-buffering": "no",   // discourage intermediary buffering
  ...corsHeaders(),
});
```

**Timeout math (critical — read before writing code):**
- Netlify function clock: default **10s**, hard max **26s** (`maxDuration = 26` in config above). **Streaming does not reset the clock** — the function must resolve within 26s or Netlify cuts it mid-stream (client sees `STREAM_BROKEN`).
- Budget: reserve ~1.5s for validation + provider connect. Upstream fetch timeout = **20s** (via `abortWithTimeout(signal, 20_000)` chaining the client's AbortSignal — do **not** rely on `AbortSignal.any`, Node 20 support varies on Netlify).
- MVP guardrails: default `max_tokens: 512`, default `temperature: 0.7`, and a client-side AbortController at 25s. Short prompts only.
- **Post-MVP (documented, not built):** long generations → background function (15 min) + job-polling endpoint + CRT "TAPE LOADING…" progress. Flagged for the roadmap, not this blueprint.

**Mock fallback (MVP, zero-config demo):** when `MOCK_AI=true`, or (`ALLOW_MOCK_FALLBACK=true` and the target model's key is missing), the provider's `mockStream()` yields:
- `meta` with `mock: true` (CRT shows a "SIMULATION MODE" badge),
- ~6–10 `delta` chunks of a canned retro-flavored reply (e.g., *"PUNCH CARD ACCEPTED. PROCESSING WITH 64K OF PURE CHAOS…"*), spread with `await sleep(150)` between chunks,
- a final `usage` + `done`.

This keeps the whole CRT/Hopper experience demoable before any key is configured.

### 2.9 Error handling

`_shared/errors.ts` maps every failure to the envelope from §2.5-B. Mapper rules: redact any upstream body that might echo secrets (never forward raw upstream error text; use `message` + `code`), and tag `retryable`.

| Code | Meaning | HTTP | retryable | CRT display |
|---|---|---|---|---|
| `BAD_REQUEST` | schema/validation failure | 400 | false | yellow "SYNTAX ERROR" + field issues |
| `MODEL_NOT_CONFIGURED` | key missing, mock off | 400 | false | "not wired up yet" |
| `UPSTREAM_401` | bad/expired key | 502 | false | "AUTH REJECTED" |
| `UPSTREAM_429` | rate limited / quota | 503 | true | "SYSTEM BUSY — retry" |
| `UPSTREAM_5xx` | upstream down | 502 | true | "MAINFRAME DOWN" |
| `UPSTREAM_TIMEOUT` | 20s upstream timeout | 504 | true | "TRANSMISSION TIMEOUT" |
| `STREAM_BROKEN` | client aborted / Netlify cut | n/a (client-side) | true | "CONNECTION LOST" |
| `INTERNAL` | unhandled | 500 | false | generic red block |

Per-model isolation: a failure for `glm` never affects `claude`/`gpt` — the registry resolves one provider per request; errors carry `model` so the CRT can annotate which switchboard port failed.

### 2.10 CORS

Same-origin in production (`/api/execute-card` on the same Netlify site), but dev runs `vite` on `localhost:5173` with `netlify dev` proxying — still set explicit headers:

```ts
export const corsHeaders = () => ({
  "access-control-allow-origin": process.env.CORS_ORIGIN ?? "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
});
export const preflight = () => new Response(null, { status: 204, headers: corsHeaders() });
```

🔌 **IP-5:** when the security review lands, replace `*` with an explicit origin allowlist via `CORS_ORIGIN` (and restrict `VITE_POCKETBASE_URL` origins in PocketBase CORS config).

### 2.11 Frontend client — `src/lib/api.ts` (CRT stream consumer)

```ts
import type { TargetModel } from "./pocketbase"; // shared slug type

export interface ExecuteCardRequest {
  prompt: string;
  target_model: TargetModel;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ExecuteHandlers {
  onMeta?(m: { model: TargetModel; mock: boolean; run_id: string }): void;
  onDelta(text: string): void;
  onDone?(): void;
  onError(e: { code: string; message: string; retryable: boolean }): void;
}

/** POST + parse SSE. Returns an AbortController the caller can abort. */
export function executeCardStream(req: ExecuteCardRequest, h: ExecuteHandlers): AbortController {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000); // client-side 25s cap (§2.8)

  (async () => {
    const res = await fetch("/api/execute-card", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) {
      const env = await res.json().catch(() => null);
      h.onError(env?.error ?? { code: "INTERNAL", message: `HTTP ${res.status}`, retryable: false });
      return;
    }

    // Minimal SSE parser: buffer on \n\n, read "event:" + "data:" lines.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const ev = JSON.parse(dataLine.slice(5));
        if (ev.type === "meta") h.onMeta?.(ev);
        else if (ev.type === "delta") h.onDelta(ev.text);
        else if (ev.type === "done") h.onDone?.();
        else if (ev.type === "error") h.onError(ev);
      }
    }
  })().catch((err) => {
    if (err?.name === "AbortError") h.onError({ code: "STREAM_BROKEN", message: "CONNECTION LOST", retryable: true });
    else h.onError({ code: "INTERNAL", message: String(err), retryable: false });
  }).finally(() => clearTimeout(timer));

  return ctrl;
}
```

### 2.12 Security / pricing review — integration points (🔌)

The parallel review (auto-truncation, key vault) lands in a later revision. Slot-in points are pre-wired:

- 🔌 **IP-1 — Key vault.** `_shared/env.ts` `getApiKey(slug)` is the **only** place keys are read. Vault swap (e.g., Netlify secrets, external vault) = replace this one function's internals; no other file changes. `process.env` is banned everywhere else.
- 🔌 **IP-2 — Budget / auto-truncation / rate limit.** Insert as a guard in `execute-card.ts` STEP 2 (marked). Hooks: per-model daily cost cap, per-user quota, `truncateForModel()` before STEP 3. `MAX_PROMPT_CHARS` already gates length.
- 🔌 **IP-3 — Redaction & logging.** `_shared/stream.ts` has a single `logSafe()` helper (strips keys/authorization, never logs prompt bodies). Telemetry findings patch one place.
- 🔌 **IP-4 — Data-layer review.** PocketBase `usage_log`/`settings` future collections (§3.6) are schema-gated by the review. **Key vault is explicitly NOT a PocketBase collection** — PocketBase is client-reachable; keys must stay behind `env.ts`.
- 🔌 **IP-5 — CORS tightening.** §2.10 allowlist swap.

---

## 3. POCKETBASE STUB ARCHITECTURE

### 3.1 Collections — `Prompts` (the saved punch-card deck)

**Collection name:** `Prompts` (exact casing). Public read/list enabled for MVP (single-user personal app); **create/update/delete require auth** — for MVP, PocketBase user auth is optional; if enabled, wire `pb.authStore` and scope rules `@request.auth.id != ""`. Final auth model = 🔌 IP-4 decision.

| Field | Type (PocketBase) | Required | Constraints / default |
|---|---|---|---|
| `id` | text (auto PK) | — | auto-generated `abc123…` |
| `title` | text | yes | min 1, max 80 chars — the card's label on the bench |
| `prompt` | text (multiline) | yes | min 1, max 32000 chars — the actual prompt payload |
| `system_prompt` | text (multiline) | no | default `""` — optional card-level system context |
| `target_model` | select (single) | yes | allowed values: **`claude` \| `gpt` \| `glm`** (slugs only!) |
| `favorite` | bool | no | default `false` — pins a card to the top of the bench |
| `created_at` | date | no | ISO-8601; **set by the API helper/seed** (see note below) |
| `updated_at` | date | no | maintained by `updatePrompt()` helper |

> **Note on `created_at`:** PocketBase auto-maintains `created`/`updated` on every record. We additionally carry an explicit `created_at` (canonical sort + seed field) per project spec — the `createPrompt()` helper sets it (`new Date().toISOString()`); the seed file provides it. UI sorts by `-created_at`.

**Record shape returned by the SDK (JSON):**

```json
{
  "id": "8f2k1d3m0x9a",
  "collectionId": "pbc_…",
  "collectionName": "Prompts",
  "created": "2026-08-12 18:00:00.123Z",
  "updated": "2026-08-12 18:00:00.123Z",
  "title": "Haiku about a floppy disk",
  "prompt": "Write a 5-7-5 haiku about a 5.25-inch floppy disk, 1980s tone.",
  "system_prompt": "You are a nostalgic terminal poet.",
  "target_model": "glm",
  "favorite": false,
  "created_at": "2026-08-12T18:00:00.000Z",
  "updated_at": "2026-08-12T18:00:00.000Z"
}
```

### 3.2 Seed contract — `default-cards.json` (for "AI Data")

Must conform **exactly** to these field names/types so the import is a straight write. `id` and `updated_at` are optional (PocketBase assigns/creates them); everything else must validate.

```json
{
  "cards": [
    {
      "title": "Haiku about a floppy disk",
      "prompt": "Write a 5-7-5 haiku about a 5.25-inch floppy disk, 1980s tone.",
      "system_prompt": "You are a nostalgic terminal poet.",
      "target_model": "glm",
      "favorite": false,
      "created_at": "2026-08-12T18:00:00.000Z"
    }
  ]
}
```

Validation checklist for the seed (AI Data → Dave → PocketBase):

- [ ] `title`: string, 1–80 chars, required
- [ ] `prompt`: string, 1–32000 chars, required
- [ ] `system_prompt`: string (may be `""`), optional
- [ ] `target_model`: string, one of **`"claude"` | `"gpt"` | `"glm"`** — slugs, lowercase, **no display names**
- [ ] `favorite`: boolean, optional (default `false`)
- [ ] `created_at`: ISO-8601 string (e.g., `2026-08-12T18:00:00.000Z`), optional
- [ ] No other top-level record fields (extra keys stripped by the import script)

Import path (Dave): `scripts/seed-pocketbase.ts` — SDK + admin email/password from env (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`, server-side only), `authWithPassword`, upsert each card idempotently (match on `title`), skip if exists. Alternative for one-off: PocketBase Admin UI → Collections → *Prompts* → New record. Do **not** commit real admin credentials.

### 3.3 Client stub — `src/lib/pocketbase.ts` (full file)

```ts
import PocketBase from "pocketbase";

// ── Env wiring ──────────────────────────────────────────────────────────────
export const POCKETBASE_URL: string =
  import.meta.env.VITE_POCKETBASE_URL ?? "http://127.0.0.1:8090";

export const pb = new PocketBase(POCKETBASE_URL);

// ── Types (mirror the Prompts collection exactly) ───────────────────────────
export type TargetModel = "claude" | "gpt" | "glm";

export interface PromptCard {
  id: string;
  title: string;
  prompt: string;
  system_prompt: string;
  target_model: TargetModel;
  favorite: boolean;
  created_at: string;   // canonical sort/seed field (project spec)
  updated_at: string;
}

export interface CreatePromptInput {
  title: string;
  prompt: string;
  system_prompt?: string;
  target_model: TargetModel;
  favorite?: boolean;
}

// ── Typed helpers ───────────────────────────────────────────────────────────
export async function listPrompts(options: { signal?: AbortSignal } = {}): Promise<PromptCard[]> {
  return pb.collection("Prompts").getFullList<PromptCard>({
    sort: "-created_at",
    signal: options.signal,
  });
}

export async function createPrompt(input: CreatePromptInput): Promise<PromptCard> {
  return pb.collection("Prompts").create<PromptCard>({
    ...input,
    system_prompt: input.system_prompt ?? "",
    favorite: input.favorite ?? false,
    created_at: new Date().toISOString(),
  });
}

export async function updatePrompt(
  id: string,
  patch: Partial<CreatePromptInput>,
): Promise<PromptCard> {
  return pb.collection("Prompts").update<PromptCard>(id, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

export async function deletePrompt(id: string): Promise<void> {
  await pb.collection("Prompts").delete(id);
}
```

Rules: `pocketbase` SDK latest stable (API used: `getFullList` / `create` / `update` / `delete` — stable across ≥0.22). Do **not** import `process.env` here — Vite env via `import.meta.env` only. No other module may construct a second PocketBase client.

### 3.4 Bench integration note (Punch Card bench ↔ PocketBase ↔ function)

`src/hooks/usePrompts.ts` wraps §3.3:

```ts
export function usePrompts() {
  const [cards, setCards] = useState<PromptCard[]>([]);
  const refresh = useCallback(async () => setCards(await listPrompts()), []);
  // refresh() on mount; createPrompt/updatePrompt/deletePrompt call refresh() after success
  // cards feed the Punch Card bench list; "NEW CARD" form → createPrompt()
  return { cards, refresh, create: ..., update: ..., remove: ... };
}
```

Execution wiring (Hopper): a card's `prompt` + `target_model` (+ optional `system_prompt`) are passed **verbatim** to `executeCardStream()` (§2.11). The card is never re-serialized — the same slug vocabulary flows: PocketBase enum → request body → provider registry. If a card's `target_model` key is unset server-side, the CRT gets `MODEL_NOT_CONFIGURED` or the mock fallback per `ALLOW_MOCK_FALLBACK`.

### 3.5 Env wiring — `.env.example`

```
# ── Frontend (public — VITE_ prefix; committed shape, values local) ─────────
VITE_POCKETBASE_URL=http://127.0.0.1:8090

# ── Server-side only (Netlify dashboard env — NEVER VITE_, NEVER in client) ─
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ZAI_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
OPENAI_MODEL=gpt-4o
ZAI_MODEL=glm-5.2
MOCK_AI=false
ALLOW_MOCK_FALLBACK=true
MAX_PROMPT_CHARS=32000
CORS_ORIGIN=*
# Seed script only (never commit values):
PB_ADMIN_EMAIL=
PB_ADMIN_PASSWORD=
```

Deployment (MJW Personal App Platform): set the three `*_API_KEY`s in the Netlify site env; set `VITE_POCKETBASE_URL` to the hosted PocketBase URL; ensure PocketBase CORS allows the Netlify site origin (🔌 IP-5 pairing).

### 3.6 Future collections (do not create yet — 🔌 IP-4 gates)

| Collection | Purpose | Keys? |
|---|---|---|
| `usage_log` | per-run audit: run_id, model, tokens, ok/fail | **never** |
| `settings` | UI prefs (theme, default model, CRT palette) | **never** |
| (none) | key vault | **never** — keys live server-side behind `env.ts` only |

---

## 4. Acceptance checklist (Dave)

- [ ] `netlify/functions/execute-card.ts` + `_shared/*` per §2.1–2.7; zero `process.env` outside `env.ts`
- [ ] SSE contract per §2.5; `meta` first, exactly one of `done`/`error` last
- [ ] Mock fallback works with **no keys** configured (`MOCK_AI` / `ALLOW_MOCK_FALLBACK` paths)
- [ ] `maxDuration = 26`, upstream timeout 20s, client abort 25s
- [ ] Error envelope per §2.9 codes; upstream error text never forwarded raw
- [ ] `src/lib/pocketbase.ts` per §3.3; single client instance; `VITE_POCKETBASE_URL`
- [ ] `Prompts` collection created per §3.1; seed import passes §3.2 checklist; `target_model` slugs only
- [ ] End-to-end: save card → drop in Hopper → switchboard toggle → CRT streams deltas → card reusable
- [ ] Build + `netlify dev` clean; deploy to MJW Personal App Platform

## 5. Open questions

1. **Claude model default:** blueprint defaults `ANTHROPIC_MODEL=claude-sonnet-4-5` (env-overridable). Confirm or supply the exact model ID to hard-pin.
2. **Netlify plan:** 26s `maxDuration` may require a paid tier on the MJW platform (10s on free). If free-only, we shrink `max_tokens` default and lean harder on mock mode — need confirmation.
3. **PocketBase hosting:** confirm PocketBase runs as a container on MJW platform (and that we can configure its CORS + admin console), or if we need an alternative URL.
4. **Mock visibility in prod:** should SIMULATION MODE be user-toggled in the UI (fun demo) or dev-only (`MOCK_AI`)? Currently both switches exist; default prod behavior = fallback only.
5. **Z.ai endpoint:** confirm `https://api.z.ai/api/paas/v4/chat/completions` for GLM-5.2 (OpenAI-compatible) — if the platform uses a different base URL, it's a one-line change in the `glm` adapter.
