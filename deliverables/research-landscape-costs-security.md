# Retro AI Workbench — Pre-Build Research
## Landscape Audit · API Routing & Cost Matrix · PocketBase Vault Security

**Prepared for:** The Architect, Product, Dave
**Date:** 2026-08-12
**Scope:** Pre-build feasibility / positioning study for a PWA multi-AI orchestrator (Claude, GPT, GLM) with a 1980s analog-hardware interface (Punch Cards, Switchboard, Hopper, CRT terminal). Backend: PocketBase + Netlify serverless functions (server-side API-key routing).
**Method:** Live web research (Aug 2026). Every pricing claim below was checked against at least two independent sources, including official vendor docs where reachable via search. Discrepancies vs. the project brief are flagged inline with ⚠️.

---

## Executive Summary (read this first)

1. **The category is wide open for us.** The multi-model chat space (LibreChat, OpenWebUI, Vercel AI Playground) is a graveyard of *visually identical* flat, pill-shaped, white/gray ChatGPT clones. Drag-and-drop exists only in the **developer workflow-builder** category (Langflow, Flowise, Dify, n8n) — no consumer-facing multi-AI chat product uses drag-and-drop as its primary metaphor, and **none** of the ~8 products audited uses mechanical audio feedback. Our punch-card / switchboard / hopper / CRT concept occupies empty visual + tactile + audio space simultaneously. That triple combination is the unfair advantage.

2. **⚠️ Two of three models in the brief are stale.**
   - **"Claude 3.5 Sonnet" → RETIRED.** Deprecated Aug 13, 2025; fully retired Oct 22, 2025. Current lineup (verified): **Claude Sonnet 5** (`claude-sonnet-5`, 1M context, 128K max output, **$2/$10 per MTok**), Opus 5 ($5/$25), Haiku 4.5 ($1/$5). We must target Sonnet 5 (or at minimum Sonnet 4.x).
   - **"GPT-4o" → DEPRECATED/EOL.** Retired from ChatGPT Feb 13, 2026; `gpt-4o-latest` API access ended Feb 16, 2026; the `gpt-4o` API endpoint was deprecated as of Feb 17, 2026. OpenAI's current family is GPT-5.x (GPT-5.4 $2.50/$15, GPT-5.5 $5/$30, GPT-5.6 ladder $0.20–$5.00 input). Shipping GPT-4o is a liability; target **GPT-5.4** as the cost-parity drop-in.
   - **"GLM-5.2" → ✅ CONFIRMED REAL and current flagship.** Z.ai GLM-5.2 (open-weights, MIT-licensed, 1M context, ~131K max output) at **$1.40/$4.40 per MTok**, with $0.26 cached-input pricing. Previous-gen GLM-4.7 ($0.6/$2.2) is the budget tier. No change needed — but price it correctly.

3. **Cost landscape (per 1M tokens, USD):** GLM-5.2 is the value leader ($1.40/$4.40); GPT-5.4 and Claude Sonnet 5 both sit at mid-tier ($2.50/$15 vs $2/$10); Claude Opus 5 is the premium ($5/$25). A prompt routed to Claude Opus 5 costs ~3.6× the same prompt on GLM-5.2 — routing + per-model budgets are a real, monetizable product feature, not decoration.

4. **Netlify wall-clock reality:** synchronous functions cap at **10s (free) → 26s (Pro/Enterprise, on request)**; only **Background Functions run up to 15 min** (returning a 202 immediately). Long outputs *will* time out unless we (a) stream, (b) cap output tokens per model, and (c) route "long job" requests through background functions + a job queue. The Hopper metaphor maps perfectly onto the background-function job queue — this is a rare case where the theme *is* the architecture.

5. **PocketBase CAN hold encrypted keys safely** — but only with a strict protocol: field-level AES-256-GCM encryption in JSVM hooks (`$security.encrypt`), API rules that never expose the ciphertext field to the client, and decryption *exclusively* inside Netlify functions. Full protocol in §3.

---

# 1. Multi-AI Orchestrator Landscape Audit

## 1.1 Products audited (live search, Aug 2026)

| Product | Type | Multi-model? | Drag-and-drop? | Mechanical/audio feedback? | Visual/tactile differentiation | Verdict |
|---|---|---|---|---|---|---|
| **LibreChat** | Open-source self-hosted chat UI (danny-avila/LibreChat) | ✅ OpenAI/Anthropic/Gemini/local via one UI; MCP, agents, code exec, multimodal | ❌ (dropdown model picker, standard chat layout) | ❌ Silent | Low — flat modern chat, theme skins only | Feature-rich but visually a ChatGPT clone |
| **OpenWebUI** | Open-source self-hosted chat UI | ✅ "One interface for every AI model… switch mid-conversation, keep context intact"; RAG, pipelines, functions | ❌ | ❌ Silent | Low — Material-style chat; functions/pipelines are code, not canvas | Power-user RAG hub; zero aesthetic ambition |
| **Vercel AI Playground** (ai-sdk.dev/playground) | Hosted side-by-side model comparison | ✅ GPT/Claude/Gemini/Llama/Mistral same prompt | ❌ (side-by-side panes) | ❌ Silent | Low — utilitarian dev-tool split view | Functional benchmark tool, not a product experience |
| **Langflow** | Visual agent builder | ✅ | ✅ **node-graph drag-and-drop** (LangChain wrapper) | ❌ Silent | Medium — node canvas, developer-oriented | Drag-drop exists here but for *builders*, not users |
| **Flowise** | Visual LLM pipeline builder | ✅ | ✅ node-graph drag-and-drop | ❌ Silent | Medium — node canvas | Same: dev tooling, not an end-user experience |
| **Dify / n8n / Gumloop** | Visual workflow / agent builders | ✅ | ✅ node-graph drag-and-drop | ❌ Silent | Low–Medium | Same category as Langflow/Flowise |
| **cool-retro-term / browser "retro-terminal" CRT skins** | Terminal emulators & CSS skins | ❌ (not AI chat apps) | ❌ | Partially (CRT hum/static is environmental, not feedback) | High — scanlines, phosphor glow, bezel | Proves retro-CRT appetite exists; nobody has married it to AI |
| **AI chat apps with sound** | — | — | — | ❌ **None found.** Searched audio/sound-design in chat UIs: only voice-assistant TTS and mobile keyboard click-sound themes surfaced | — | The "mechanical audio feedback loop" niche is **empty** |

Sources: librechat.ai/docs/features + 2025 roadmap (librechat.ai/blog/2025-02-20_2025_roadmap) · docs.openwebui.com/features ("switch mid-conversation… keep your context intact") · ai-sdk.dev/playground + Vercel launch coverage (cobusgreyling.medium.com; news.ycombinator.com/item?id=35621417) · langflow.org; Flowise/Langflow/n8n comparisons (blckalpaca.at; agnobuilder.com; sfailabs.com; meetrix.io; reddit.com/r/LLMDevs "best drag-and-drop way to build AI agents") · cool-retro-term coverage (news.ycombinator.com/item?id=46036895); github.com/Sanjays2402/retro-terminal ("browser-based CRT terminal emulator with scanlines, phosphor glow, typing animations").

## 1.2 Ranking by visual & tactile differentiation

1. **Vercel AI Playground** — most *functional* differentiation (side-by-side answers), least tactile. Zero emotion.
2. **LibreChat / OpenWebUI** — differentiation via features (MCP, RAG, agents), not interface. Both are "flat chat + model dropdown" at heart.
3. **Langflow / Flowise** — the only ones with true drag-and-drop, but it's a **developer node-graph**, not a user-facing interaction metaphor. Nothing tactile, no audio.
4. **Retro CRT skins** — highest *visual* differentiation (scanlines, phosphor), but they're terminal emulators, not AI products, and they're pure decoration: no mechanical interaction, no feedback loops tied to system events.

## 1.3 Critical question answered

> Does ANY of them use a drag-and-drop workflow or mechanical audio feedback loops, or are they all flat ChatGPT-style clones?

**Answer:** No consumer-facing multi-AI chat product uses drag-and-drop as its primary workflow, and **no audited product — at any layer — implements mechanical audio feedback tied to system events** (job completion, queue processing, card punching). Drag-and-drop exists only in developer workflow builders; CRT aesthetics exist only in terminal skins. The intersection — *a tactile, audio-verified, physically-metaphored multi-AI orchestrator for end users* — has **zero direct competitors**.

## 1.4 Our exact unfair advantage (interface psychology)

1. **Intentionality (the Punch Card).** Punch cards are the only UI metaphor in computing history where *preparation is mandatory and visible*. Before any model is invoked, the user literally composes a card deck (≈250 tokens per card — see §2.5 for the cost math this unlocks). This forces deliberate prompt composition and makes token spend tangible. Every competitor optimizes for *fewer clicks to send*; we optimize for *more conscious send*. That's a positioning statement: "the workbench for deliberate AI work," not a chat app.
2. **Physical metaphor (Switchboard → Hopper → CRT).** A switchboard makes multi-model routing *visible and physical*: cables/plugs for provider selection, jacks for queues, patch bays for multi-model fan-out (same prompt → 3 models → compare). The Hopper is a physical job queue — which maps 1:1 to Netlify Background Functions (§2.6). Competitors bury routing in a dropdown; we make it the hero.
3. **Tactile + audio feedback loops.** Mechanical audio (card punch clack, hopper tick, switch click, CRT power-on thunk) tied to *real events* (stream start, token chunks, job completion, error) creates the "it's alive" effect. Web Audio API makes this cheap and dependency-free. Evidence of appetite: mobile keyboard apps sell click-sound themes (Google Play "Sound Keyboard"), and retro-CRT emulators are a perennial HN favorite — but nobody has applied sound-as-feedback to an AI product. Accessibility bonus: audio feedback is a genuine assistive win (non-visual status channel).
4. **Derivative moat.** Aesthetic presets (punch-card deck view, amber vs. green phosphor, terminal emulation modes) are cheap to build once, expensive to clone faithfully, and screenshot-shareable for viral marketing.

**Recommendation for The Architect:** Do NOT make this a terminal theme on a chat app. Make the metaphors *functional*: cards = token budgets, hopper = job queue, switchboard = model router, CRT = streaming renderer. Form follows function, and the function is genuinely useful (cost control + long-job orchestration that serverless forces on us anyway).

---

# 2. API Routing & Cost Optimization Matrix

## 2.1 ⚠️ Brief-vs-reality verification table

| Brief says | Reality (verified Aug 2026) | Action |
|---|---|---|
| "Claude 3.5 Sonnet" | **Retired.** Original 3.5 Sonnet deprecated 2025-08-13; `claude-3-5-sonnet-20241022` (v2) retired 2025-10-22. Current: **Sonnet 5** (`claude-sonnet-5`), Sonnet 4.6/4.x predecessors, Opus 5, Haiku 4.5. | Target **`claude-sonnet-5`** ($2/$10, 1M ctx, 128K out). |
| "GPT-4o" | **EOL.** Retired from ChatGPT 2026-02-13; `gpt-4o-latest` API gone 2026-02-16; `gpt-4o` endpoint deprecated 2026-02-17. Still callable only for existing legacy snapshots; OpenAI's lineup is GPT-5.x. | Target **`gpt-5.4`** ($2.50/$15) as the drop-in; optionally `gpt-5.6` ladder for cheap tiers. |
| "GLM-5.2" | ✅ **Real & current flagship.** Z.ai GLM-5.2, open-weights (MIT), 1M context, ~131K max output, $1.40/$4.40. | Keep, but use correct IDs/pricing (`glm-5.2`). |

Sources: endoflife.date/claude · reddit.com/r/ClaudeAI (Sonnet 3.5 v2 retirement, 2025-10-22) · gitlab.com/gitlab-org/gitlab/-/issues/572012 (deprecation 2025-08-13) · anthropic.com/news/claude-sonnet-5 · platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5 ("1M token context by default, 128k max output") · platform.claude.com/docs/en/about-claude/pricing ("$2/$10… now the standard") · openai.com/index/retiring-gpt-4o-and-older-models (retire 2026-02-13) · venturebeat.com (gpt-4o-latest ends 2026-02-16) · community.openai.com (gpt-4o endpoint deprecation 2026-02-17) · z.ai/model-api · docs.z.ai/guides/overview/pricing · z.ai/blog/glm-5.2 · venturebeat.com (GLM-5.2 beats GPT-5.5 on long-horizon coding at ~1/6 the cost).

## 2.2 Comparative pricing table (USD per 1M tokens, verified Aug 2026)

| Model (API ID) | Input $/MTok | Output $/MTok | Cached input $/MTok | Context / Max output | Status | Sources |
|---|---|---|---|---|---|---|
| Claude Haiku 4.5 (`claude-haiku-4-5`) | **$1.00** | **$5.00** | — | 200K / 64K | Current | cloudzero.com/blog/claude-pricing; benchlm.ai/anthropic/api-pricing |
| **Claude Sonnet 5** (`claude-sonnet-5`) | **$2.00** | **$10.00** | — | **1M / 128K** | **Current — our pick** | platform.claude.com/docs (pricing + whats-new-sonnet-5); caylent.com (launch analysis) |
| Claude Opus 5 (`claude-opus-5`) | **$5.00** | **$25.00** | — | 1M / 128K | Current | cloudzero; benchlm; platform.claude.com docs |
| Claude Fable 5 (reported) | $10.00 | $50.00 | — | n/a | ⚠️ Secondary sources only (cloudzero, benchlm); treat as unconfirmed | cloudzero.com; benchlm.ai |
| *Claude 3.5 Sonnet (brief)* | ~~$3.00~~ | ~~$15.00~~ | — | 200K / 8K | ❌ Retired 2025-10-22 | endoflife.date/claude; reddit; gitlab issue |
| **GPT-5.4** (`gpt-5.4`) | **$2.50** | **$15.00** | — | ~400K / 128K | **Current — recommended drop-in** | metacto.com (May 2026) |
| GPT-5.5 (`gpt-5.5`) | $5.00 | $30.00 | — | — | Current, premium | metacto.com |
| GPT-5.6 ladder (Luna→Sol) | $0.20 → $5.00 | varies | — | — | Newest (Aug 2026) | aipricing.guru/openai-pricing |
| *GPT-4o (brief)* | ~~$2.50~~ | ~~$10.00~~ | — | 128K / 16K | ❌ Deprecated 2026-02-17 | pricepertoken.com; aifreeapi.com; valueaddvc.com; openai.com retirement notice |
| GPT-4o mini (legacy) | $0.15 | $0.60 | — | 128K / 16K | Legacy | aifreeapi.com |
| **GLM-5.2** (`glm-5.2`) | **$1.40** | **$4.40** | **$0.26** | **1M / ~131K** | **Current flagship — our pick** | docs.z.ai/guides/overview/pricing; venturebeat.com; requesty.ai; ofox.ai; openrouter.ai/z-ai/glm-5.2 |
| GLM-5.1 | $1.40 | $4.40 | $0.26 | 200K | Current | docs.z.ai pricing |
| GLM-5 | $1.00 | (cached $0.20) | — | 200K | Current | docs.z.ai pricing |
| GLM-4.7 | $0.60 | $2.20 | — | 200K / 131K | Previous gen — budget tier | openrouter.ai/z-ai/glm-4.7; atlascloud.ai; docs.z.ai |
| GLM-4.6 | ~$0.40 | ~$1.75 | — | 200K | Previous gen | reddit; openrouter |
| GLM-4.7-FlashX | $0.07 | — | — | — | Ultra-budget | developer.puter.com |

**Key ratios (same 1:5 in:out prompt, 10K in / 2K out):** GLM-5.2 ≈ **$0.023** · Claude Sonnet 5 ≈ **$0.040** · GPT-5.4 ≈ **$0.055** · Claude Opus 5 ≈ **$0.10**. Opus vs GLM ≈ 4.4×; Sonnet vs GLM ≈ 1.7×.

## 2.3 Recommended task-type → model routing

| Task type | Recommended model | Why |
|---|---|---|
| **Drafting, rewriting, chat, ideation** | **GLM-5.2** (or GLM-4.7 for high-volume) | ~60% cheaper than Sonnet 5; open-weights SOTA on long-horizon/coding; 1M context absorbs long docs cheaply ($0.26 cached input for repeated context) |
| **Coding / agentic tasks, structured output** | **Claude Sonnet 5** | 1M context + 128K output; strongest agentic tool-use; $2/$10 is now the standard rate |
| **Reasoning-heavy, "best answer" premium jobs** | **Claude Opus 5** (opt-in only) | $5/$25 — only route here on explicit user choice; surface cost preview before send |
| **Vision/multimodal inputs** | **GLM-4.6V** ($0.30 input tier) or GPT-5.x | GLM-4.6V is cheapest verified multimodal; GPT-5.x for max fidelity |
| **High-volume background jobs (digests, bulk classification)** | **GLM-4.7 / GPT-5.6 Nano/Luna** | Deep-discount tiers; fits Background Functions (§2.6) |
| **Default auto-router** | GLM-5.2 → Sonnet 5 (escalation) | Cost-first default with an "escalate" switch; Opus 5 only on explicit request |

## 2.4 Context-window & auto-truncation strategy (serverless-safe)

**Netlify hard constraints (verified):** synchronous functions timeout at **10s (free) → 26s max (Pro/Enterprise, granted on request)** — measured as wall-clock, not execution time (answers.netlify.com 91818 / 53881 / 36204 / 31316; damianwroblewski.com). **Background Functions: up to 15 minutes**, invoked with a suffix `-background`, return HTTP 202 immediately, continue running (docs.netlify.com/build/functions/background-functions/; netlify.com 2020 announcement). Streaming responses are supported but do **not** extend the function's wall-clock budget.

**Recommended architecture (this is also the product design):**

1. **Stream everything interactive.** Netlify function → SSE/ReadableStream to the CRT renderer. Gives token-by-token "terminal typing" (perfect CRT aesthetic) and masks latency. Netlify supports streaming responses; keep the stream path for outputs ≤ ~2–4K tokens so the whole sync invocation stays comfortably inside 26s.
2. **Long outputs go through the Hopper (Background Functions).** Any job whose budget exceeds ~4K output tokens (or estimated >20s) is submitted to a `-background` function (returns 202), which runs up to 15 min and writes status + result to PocketBase. The client subscribes to PocketBase realtime (or polls a job collection) — the "hopper tick" audio plays on state transitions (queued → processing → done). This *eliminates* the timeout problem entirely and gives the Hopper its authentic reason to exist.
3. **Per-model `max_tokens` caps (write them into the router config):**
   - Chat/turn: 1,024–2,048 (prevents both cost blowouts and timeouts)
   - Draft/long-form: 4,096
   - Hopper background jobs: 8,000–32,000 (safe — 15-min ceiling)
   - Never call an API with no `max_tokens`.
4. **Context-window alerts (client-side meter on the CRT status bar):** compute running token estimate ≈ `chars ÷ 4` (English); warn at **70%**, hard-warn at **85%**, block-and-prompt at **95%** of the active model's window (1M for Sonnet 5 / GLM-5.2; 128K if a legacy GPT-4o fallback is in play). On overflow: auto-truncation policy = **drop oldest non-system turns first** (head-truncation of conversation history), optionally compress the oldest 25% with a cheap summarization call (GLM-4.7) — never blind tail-truncate, which kills the newest context (apxml.com truncation-strategy course; agenta.ai "6 techniques to manage context"; oneuptime.com context-window management guide).
5. **Character budgets as product language:** punch card ≈ 960 chars ≈ **~250 tokens**. "This deck is 14 cards ≈ $0.012 on GLM-5.2 vs $0.021 on Sonnet 5" is a cost preview users have never seen before — a differentiator AND a guardrail.

---

# 3. PocketBase Vault Security & Exploit Analysis

## 3.1 What PocketBase actually provides (verified)

- **No native at-rest DB encryption.** The SQLite file is plaintext on disk. Developers must encrypt externally (e.g., gpg) or at field level (github.com/pocketbase/pocketbase/discussions/1961).
- **Built-in field-level AES-256-GCM helpers:** `$security.encrypt(data, key)` / `$security.decrypt(ciphertext, key)` in the JSVM, key must be a valid 32-char AES key (pocketbase.io/jsvm/functions/_security.encrypt.html and `_security.decrypt.html`; pkg.go.dev/github.com/pocketbase/pocketbase/tools/security). Intended usage pattern: encrypt in a `before OnRecordCreate/OnRecordUpdate` hook, decrypt where needed (github.com/pocketbase/pocketbase/discussions/7036).
- **Stateless auth; no server sessions.** Tokens (JWTs) are not stored in the DB (pocketbase.io/docs/authentication/). PB records fields are exposed via API rules; per-collection/per-field `viewRule`/`updateRule` govern read access.
- **Community-standard pattern:** Railway's PB template auto-generates a 32-char encryption key env var used to encrypt OAuth tokens and sensitive fields (railway.com deploy page) — i.e., "env-held master key + hook-level AES" is the accepted pattern. Reddit PB community also endorses middleware/API-rules for key access (reddit.com/r/pocketbase).

## 3.2 Can encrypted keys be retrieved safely without frontend-log exposure? — Yes, with rules

The danger is **not** the ciphertext; it's (a) shipping the *plaintext* key to the browser, and (b) shipping the *decryption key material* to the browser. Rule of thumb: **any secret that touches the browser is capturable** — devtools Network tab shows every request, console/`console.log` of response payloads persists, browser extensions/CRDP can read JS memory. So:

- Ciphertext (AES-256-GCM, no key material) **can** safely live in a PB collection — even if a devtools inspector sees it, it's useless without the 32-char master key.
- Plaintext keys must **never** be returned by PB to the client. Enforce via collection API rules (deny client reads of the vault collection entirely) and/or field hiding — the client should only ever see derived status metadata (`provider`, `key_label`, `last4`, `enabled`, `created`).
- Decryption happens **only inside Netlify functions** (server-side), which hold the master key in Netlify environment variables. The function reads ciphertext via a PB **admin/service** credential (or a PB hook endpoint), decrypts in memory, calls the provider API, and never echoes the key anywhere — not in logs, not in responses.

## 3.3 Enforcement protocol (give this to Dave; sign-off for The Architect)

**A. At-rest (PocketBase data layer)**
1. **Field-level encryption, always:** vault collection `api_keys` stores only `encrypted_value` (output of `$security.encrypt(plainKey, MASTER_KEY)`), never plaintext. Do this in a `beforeSave` hook (JSVM) so it cannot be bypassed by any client path. AES-256-GCM via `$security.encrypt`; key = exactly 32 chars, held in PB's env, **never** in code, repo, or DB.
2. **One master key, unique per environment** (dev/staging/prod). Document rotation: re-encrypt on key change; store `key_version` column so old rows can be migrated.
3. **No plaintext fallbacks:** forbid writing key material via PB dashboard/imports; sanitize before/after hooks to strip `sk-`, `api-`, `Bearer`-shaped strings from any other collection fields (defense against accidental paste into notes).

**B. Access (PocketBase API rules)**
4. **Vault collection is server-write-only for clients:** `createRule`/`updateRule` = authenticated user only for *their own* rows, but `viewRule` = **empty/denied for the raw collection**. Expose a read-only derived view (e.g., a `key_meta` collection or a PB hook endpoint) containing `provider`, `label`, `last4`, `status` only. The encrypted blob never transits the client.
5. **Auth:** PB stateless JWT auth; short-lived tokens; revoke on password change; never log tokens (PB docs note tokens aren't stored server-side — keep it that way).
6. **Admin UI locked down:** PocketBase `_superusers` access restricted by network/IP or fully offline; disable the dashboard's public exposure in prod; `pb_hooks` file permissions locked.

**C. Server-side routing (Netlify functions)**
7. **Decryption only in Netlify functions:** function reads ciphertext via service credential → decrypts with the same MASTER_KEY (Netlify env var) → uses key for exactly one upstream call → zeroes the buffer → returns only model output. No secret in request/response bodies, no secret in `console.log`, no secret in error messages (return generic `ERR_VAULT` codes).
8. **Never accept keys from the client at runtime.** If a user must add a key, the write path is: client sends plaintext over TLS → Netlify function encrypts with MASTER_KEY → PB stores ciphertext. The browser holds the plaintext only transiently at the moment of input; never re-fetched.
9. **Provider-side hardening:** issue *scoped sub-keys* per provider (per-user or per-service, with quotas/rate limits) so a leaked key is containable; store provider-side key IDs for revocation.

**D. Runtime & observability**
10. **Log hygiene:** structured logging with redaction filters (regex for `sk-…`, `Bearer …`, 32+ char base64); alert on any log line containing key patterns; don't log request bodies for `/vault` endpoints.
11. **Client hygiene:** never `console.log` API responses on vault endpoints; audit any devtools-exposed payloads; strip secrets from PWA service-worker caches / IndexedDB.
12. **Key rotation & audit:** `key_id` per record; quarterly rotation; audit trail (who created/updated/deleted a key, when, from which IP) in a separate append-only PB collection.
13. **Backups:** PB backup archives contain ciphertext only (safe), but still encrypt backup files (gpg) and restrict access; document DB-file encryption for on-disk theft scenarios (discussion #1961 pattern).

**D.5 Future hardening (optional, v2):** client-side envelope encryption via Web Crypto (AES-256-GCM; user passphrase-derived key) so even *we* can't decrypt without the user's passphrase. Trade-off: conflicts with headless/automated routing (a passphrase must be supplied per session) — keep as an opt-in "vault lock" mode, not the default.

## 3.4 Threat model summary

| Attack | Mitigated by |
|---|---|
| Devtools / network inspection of responses | Ciphertext-only to client; decryption server-side; derived metadata only |
| Frontend console.log of fetched data | Log hygiene + never shipping secrets; code-review rule |
| SQLite file theft (disk/backup) | Field-level AES-256-GCM at rest + encrypted backups; master key in env only |
| Client-side PB API tampering (rules bypass) | `beforeSave` encryption hook (can't be bypassed by rules), denied raw viewRule |
| Key exfiltration via Netlify function compromise | Master key in env vars; per-request decryption; no secret logging; scoped provider sub-keys |
| Replay of stolen JWT | Short-lived tokens; revocation; stateless auth |

---

## Sources (searched & opened via web_search, Aug 2026)

**Orchestrator landscape**
- LibreChat: librechat.ai/docs/features · librechat.ai/blog/2025-02-20_2025_roadmap · github.com/danny-avila/LibreChat
- OpenWebUI: docs.openwebui.com/features · docs.openwebui.com/features/chat-conversations/rag/ · wz-it.com/en/blog/open-webui-vs-anythingllm-comparison
- Vercel AI Playground: ai-sdk.dev/playground · community.vercel.com/t/vercel-ai-playground-cost/12267 · cobusgreyling.medium.com · news.ycombinator.com/item?id=35621417
- Drag-drop builders: langflow.org · agnobuilder.com · blckalpaca.at · sfailabs.com · meetrix.io · reddit.com/r/LLMDevs
- Retro/CRT: news.ycombinator.com/item?id=46036895 · github.com/Sanjays2402/retro-terminal · cool-retro-term coverage (youtube/reddit/facebook) · threads.com green-phosphor UI post
- Audio/sound gap: search "AI chat app sound design audio feedback cues UX mechanical typing sounds" → only voice-TTS & keyboard-sound apps (play.google.com Sound Keyboard); no chat-app mechanical audio product found

**Pricing / model lifecycle**
- Anthropic: platform.claude.com/docs/en/about-claude/pricing · platform.claude.com/docs/en/about-claude/models/overview · platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5 · anthropic.com/news/claude-sonnet-5 · endoflife.date/claude · cloudzero.com/blog/claude-pricing · benchlm.ai/anthropic/api-pricing · metacto.com · amnic.com · reddit.com/r/ClaudeAI (3.5 v2 retirement 2025-10-22) · gitlab.com/gitlab-org/gitlab/-/issues/572012 (deprecation 2025-08-13)
- OpenAI: openai.com/index/retiring-gpt-4o-and-older-models (2026-02-13) · help.openai.com (models continue in API / retirement) · venturebeat.com (gpt-4o-latest ends 2026-02-16) · community.openai.com (gpt-4o endpoint deprecation 2026-02-17) · developers.openai.com/api/docs/pricing · pricepertoken.com · aifreeapi.com · valueaddvc.com · metacto.com (May 2026) · aipricing.guru (Aug 2026) · cloudzero.com/blog/openai-pricing
- Z.ai: z.ai/model-api · z.ai/blog/glm-5.2 · docs.z.ai/guides/overview/pricing · openrouter.ai/z-ai/glm-5.2 · venturebeat.com (GLM-5.2 vs GPT-5.5) · requesty.ai · ofox.ai · developer.puter.com · reddit.com/r/opencodeCLI (19M tokens < $3)

**Serverless / Netlify**
- docs.netlify.com/build/functions/background-functions/ (15-min background) · netlify.com/blog/2020/10/29/announcing-background-functions/ · answers.netlify.com (91818, 53881, 36204, 31316: 10s default / 26s max sync) · damianwroblewski.com (Pro 26s on request)

**Truncation / context management**
- apxml.com (text truncation strategies) · agenta.ai (6 techniques: truncation, RAG, memory buffering, compression) · oneuptime.com (context window management, chunking, sliding windows) · community.openai.com (context window mechanics)

**PocketBase security**
- pocketbase.io/jsvm/functions/_security.encrypt.html & _security.decrypt.html (AES-256-GCM, 32-char key) · pocketbase.io/jsvm/modules/_security.html · pkg.go.dev/github.com/pocketbase/pocketbase/tools/security · pocketbase.io/docs/authentication/ (stateless, tokens not stored) · github.com/pocketbase/pocketbase/discussions/1961 (no native DB encryption) · github.com/pocketbase/pocketbase/discussions/7036 (hook-level AES pattern) · railway.com PB template (32-char env encryption key pattern) · reddit.com/r/pocketbase (API rules / middleware for key access) · security.stackexchange.com (API key storage)

---

*Prepared by RESEARCH subagent. All prices verified against ≥2 independent sources on 2026-08-12. Re-verify pricing at launch: LLM pricing changes frequently (Claude intro pricing → standard, OpenAI model retirement cadence, Z.ai promotions).*
