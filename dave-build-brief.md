# Retro AI Workbench — DAVE BUILD BRIEF (Pre-Build)

**From:** Bubbles 🦞 (compiled from the 7-agent planning lane) · **Date:** 2026-08-12
**Status:** READY TO SCAFFOLD — pending Mike's sign-off on 5 open decisions (§8)
**Consume these files in this order:** Art spec → Architect blueprint → DevOps config → Product spec → QA protocol → AI Data seed

---

## 1. What you're building

A PWA multi-AI orchestrator with a 1980s analog workbench metaphor: **Punch Cards** (prompts), **Switchboard** (3 toggles, one active), **Hopper** (drop-zone that physically consumes the card), **CRT Terminal** (typewriter-streamed output). MVP ships with **mock AI mode** working with zero API keys; real providers plug in via env vars.

**Canonical stack (STRICT):** React 18 + Vite + TypeScript · Tailwind CSS + Lucide React · Netlify static + Netlify Serverless Functions (v2 style) · PocketBase ONLY. **SUPABASE IS FORBIDDEN — never import/install/reference `@supabase/supabase-js`.** Mandatory file: `src/lib/pocketbase.ts` exporting an initialized PocketBase client bound to `import.meta.env.VITE_POCKETBASE_URL`.

## 2. Model lineup (Research-verified Aug 2026 — see §8 open items)

| Slug (canonical, lowercase everywhere) | Display (pending Mike sign-off) | Provider / endpoint |
|---|---|---|
| `claude` | Claude | Anthropic Messages API — `claude-sonnet-5` (LOCKED; $2/$10 MTok). ⚠️ "Claude 3.5 Sonnet" is RETIRED. |
| `gpt` | **GPT-5.4** (LOCKED; slug stays `gpt` — "GPT-4o" is EOL Feb 2026) | OpenAI Chat Completions — `gpt-5.4` ($2.50/$15) |
| `glm` | GLM-5.2 ✅ | Z.ai, OpenAI-compatible — `https://api.z.ai/api/paas/v4/chat/completions` ($1.40/$4.40) |

**Rule: slugs only in payloads, PocketBase enums, and the seed file.** Display names are a UI concern only.

## 3. Architecture contract (The Architect — `architect-serverless-pocketbase.md`)

- **Folder:** `netlify/functions/execute-card.ts` (v2 handler: `export const config = { path: "/api/execute-card", maxDuration: 26 }`, `export default async (req: Request) => Response`) + `netlify/functions/_shared/{types,env,providers,stream,errors,validate,cors}.ts`.
- **Keys:** read ONLY in `_shared/env.ts` via `process.env` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ZAI_API_KEY`). NEVER `VITE_`-prefixed, never in the client bundle, never in PocketBase. `MOCK_AI` / `ALLOW_MOCK_FALLBACK` control mock mode.
- **Contract:** `POST /api/execute-card` `{prompt, target_model, system_prompt?, temperature?, max_tokens?, stream?}` → SSE events `meta` → `delta*` → exactly one of `done` | `error`. Error envelope codes: `BAD_REQUEST`, `MODEL_NOT_CONFIGURED`, `UPSTREAM_401/429/5xx`, `UPSTREAM_TIMEOUT`, `STREAM_BROKEN`, `INTERNAL` (see blueprint §2.9 for CRT copy mapping).
- **Timeout math (build exactly):** `maxDuration = 26`; upstream fetch timeout **20s** via chained AbortSignal (do NOT rely on `AbortSignal.any`); client-side abort at **25s**; default `max_tokens: 512`, `temperature: 0.7`.
- **PocketBase:** collection `Prompts` — fields `title` (1–80), `prompt` (1–32000), `system_prompt` (default ""), `target_model` (select: `claude|gpt|glm`), `favorite` (bool, default false), `created_at` (ISO, explicit — API helper sets it), `updated_at`. Public read for MVP; create/update/delete behind auth. Use the exact `src/lib/pocketbase.ts` + `usePrompts` from blueprint §3.3–3.4.
- **Seed import:** `scripts/seed-pocketbase.ts` — admin creds from env (`PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD`, never committed), idempotent upsert matching on `title`. `token_estimate` in the seed is UI-only metadata — **strip it before writing to PocketBase**.

## 4. DevOps config (drop in verbatim — `devops-netlify-env.md`)

- `netlify.toml` (§1): build `npm run build`, publish `dist`, functions `netlify/functions`, `NODE_VERSION = "22"`, esbuild bundler, SPA redirect `/* → /index.html` 200 **without `force = true`**, function route passthrough first. PWA cache headers for `/sw.js` + hashed `/assets/*`.
- `.env.example` (§2a): `VITE_POCKETBASE_URL` public; the three API keys server-only (Functions scope in Netlify UI — see §2c scope table).
- `.gitignore` (§3a) + 3-step pre-push verification (§3c: grep scan → git status review → post-deploy DevTools proof). Run it before the first commit to `newM1k3`.

## 5. Product decisions (LOCKED — `product-mvp-slicing.md`)

1. **Card editing: direct inline edit on the card body.** No card-catalog drawer in the MVP (v1.2 read-only CARD FILE only). Edit surface = card body; drag surface = punched-edge grip zone only.
2. **Card moves INTO the Hopper** (doesn't stay on bench). Original deck slot remembered, restored on eject. Deck cap **8** slots, Hopper cap **6** (FIFO).
3. **Routing is sampled at FEED time.** Cards are colorless until the gate opens; the engaged switch stamps the route stripe. No switch engaged at drop → gate LOCKED, card HELD, fault printed **once**, auto-resume when a switch flips.
4. **Switch flip mid-execution = deferred** (in-flight card finishes on its start core; next card takes the new route). Switchboard is single-channel radio with snap-back.
5. **States:** `MINTED → PUNCHED → READY ⇄ HELD → FEEDING → DONE/FAULT → (eject) → READY`, plus `VOIDED`. Editable only on the deck; no edit while HELD/FEEDING; no eject while FEEDING.
6. **Exact CRT copy strings (verbatim, §2.4)** — 11 strings incl. `ERROR 404: NO AI CORING UNIT ENGAGED. PLEASE FLIP SWITCH TO ROUTE TELEMETRY.` → `GATE LOCKED — CARD PRC-0007 HELD IN HOPPER.` Use them exactly; green phosphor `#33FF66` on `#050805`, faults red `#FF4444` in double-border box, blinking block cursor.
7. **5-action path:** MINT → PUNCH → ROUTE → FEED → OUTPUT. No modal in the path.

## 6. QA contract — build to pass, don't build to fix (`qa-edge-cases.md`)

Ship-blocking (⛔) requirements extracted from the protocol:
- **EDGE-01 snapshot semantics:** model snapshotted at dispatch; run banner independent of switchboard (`RUNNING · Claude`); toggle never aborts/blanks the in-flight job; one network call per execution.
- **EDGE-02 50k-word response:** NO per-character setState. Batched appends (≤2000 chars/frame), catch-up dump mode when backlog >50k chars, virtualized or ≤10k-line scrollback window, **≤25,000 DOM nodes hard cap**, single `<pre>` textContent node, heap delta ≤200MB desktop / ≤250MB mobile, abort ≤500ms, first paint ≤2000ms.
- **EDGE-03 idempotency:** one job per card id while active; `ALREADY IN HOPPER` rejection; re-run allowed after terminal state; commit-lock against double-submit races.
- **EDGE-04 empty card:** trimmed length ≥1; `REJECTED: CARD IS EMPTY — PUNCH SOME TEXT`; zero network calls; zero PB records; URL-only / 1-char cards valid.
- **EDGE-05 injection/layout:** `overflow-wrap: anywhere`; body never scrolls horizontally (scrollWidth ≤ clientWidth); **NO `dangerouslySetInnerHTML` on model/user text, ever** — plain text only until a sanitizer pipeline exists.
- **DND acceptance:** desktop native HTML5 DnD (DND-01…08) + mobile Pointer Events / long-press pick-up (~250–300ms, `navigator.vibrate(10)` Android, suppress context menu, drag threshold ~8–10px, `touch-action: none` while dragging, ≥44×44px Hopper hit target with ≥16px padding, click suppression after drag — DND-09…18). `@dnd-kit/core` pointer sensor is acceptable. Hopper children `pointer-events: none`.
- **WATCH list:** tab-switch catch-up, drag-out-of-window restore, offline/provider-fault terminal lines, no stuck states.

## 7. Art system (Dave-ready — `art-design-system.md`)

- Tailwind tokens (§1): chassis `#D8D3C4`, industrial `#2A2D32`, faux-wood `#4A2E1B`; CRT black `#0A0E08`, phosphor `#39FF14`, amber `#FFB000`; inset/outset/pressed/glow shadow presets with exact CSS values.
- 4 zones (§2): Switchboard (radio-group levers, ENGAGED LED), Punch Card (notched corner, paper texture, hole-grid), Hopper (amber "READY TO FEED" drag-over contract), CRT (scanline + glass layers, phosphor glow, `steps()` block cursor).
- Audio (§3): `src/lib/fx.ts` — `click.wav` (switch), `clack-chunk.wav` (hopper drop), `crt-hum.wav` (terminal); Web Audio autoplay handling. Micro-interaction timings 80–150ms, `prefers-reduced-motion` respected.
- `tailwind.config.js` copy-paste block included in the spec.

## 8. Open decisions — ✅ RESOLVED (Mike sign-off 2026-08-12: "go with your recs")

1. **Display labels: LOCKED — Switchboard shows CLAUDE / GPT-5.4 / GLM-5.2.** Slug stays `gpt`. Pin `ANTHROPIC_MODEL=claude-sonnet-5` (env-overridable), `OPENAI_MODEL=gpt-5.4`, `ZAI_MODEL=glm-5.2`.
2. **Netlify plan: LOCKED — tier-agnostic.** Keep `maxDuration = 26` in config (Netlify clamps to 10s on free tier), default `max_tokens: 512`, streaming + mock fallback so both tiers work. No paid-tier requirement.
3. **PocketBase hosting: LOCKED — container on MJW platform**, `VITE_POCKETBASE_URL` set to its URL, CORS allowlists the Netlify site origin, admin console locked down.
4. **Mock mode: LOCKED — fallback-only in prod** (`ALLOW_MOCK_FALLBACK=true`, `MOCK_AI=false`); dev can force mock via env; NO user toggle in the MVP UI.
5. **Art's questions: LOCKED — (a) Hopper accepts internal card drags ONLY** (external file drops = v1.1); **(b) 40-column hole-grid fallback below 480px** (80-column at ≥480px).

## 9. Build order (suggested)

1. Scaffold Vite React-TS + Tailwind + deps (`pocketbase`, `@netlify/functions`, `lucide-react`); apply DevOps files.
2. Art tokens + layout shell (Switchboard / Deck / Hopper / CRT zones).
3. `src/lib/pocketbase.ts` + `usePrompts` + seed import script.
4. DnD (deck → hopper, states, caps, lockout rules) + `src/lib/fx.ts` audio.
5. Switchboard (radio snap-back, feed-time routing, gate logic, CRT copy).
6. CRT renderer per EDGE-02 strategy + `src/lib/api.ts` SSE client + mock mode.
7. Self-pass against QA protocol; hand to QA lane.
