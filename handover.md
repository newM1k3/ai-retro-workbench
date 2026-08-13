# Retro AI Workbench — Project Kickoff & Handover

**Started:** 2026-08-12 · **Client briefs:** `client-briefs/` (10 files archived) · **Owner:** Mike via Bubbles 🦞

## What We're Building

A PWA that orchestrates multiple AI models (Claude, GPT-4o, GLM-5.2) through a nostalgic 1980s analog workbench. Not a flat chat clone — a *psychological shift*: heavy beige plastic, faux-wood trim, clacking sounds, glowing green CRT. Forces intentionality: you mint a Punch Card, flip a Switchboard switch, feed the Hopper, and watch output clack out on a CRT terminal.

**Canonical stack (strict):** React 18 + Vite + TypeScript · Tailwind + Lucide React · Netlify static + Functions · PocketBase only · **SUPABASE STRICTLY FORBIDDEN** · `src/lib/pocketbase.ts` → `import.meta.env.VITE_POCKETBASE_URL`

## Team Roster & Assignments (Planning Phase — ✅ COMPLETE 2026-08-12)

| Agent | Assignment | Deliverable file | Status |
|---|---|---|---|
| Art | Brutalist hardware design system: palette, 4 core zones, micro-interactions + audio hooks | `deliverables/art-design-system.md` | ✅ |
| The Architect | Serverless API blueprint (`execute-card.ts` routing, key protection, streaming) + PocketBase schema | `deliverables/architect-serverless-pocketbase.md` | ✅ |
| DevOps | `netlify.toml` exact config + `.env.example` + secret-safety checklist for newM1k3 repo | `deliverables/devops-netlify-env.md` | ✅ |
| AI Data | `default-cards.json` seed — 5 structured prompt cards matching Architect's schema (schema-fixed by Bubbles) | `deliverables/ai-data-default-cards.json` | ✅ |
| Research | Competitor landscape audit + API pricing matrix + PocketBase key-storage security review | `deliverables/research-landscape-costs-security.md` | ✅ |
| Product | MVP feature slice, card-editing decision, Switchboard routing logic + CRT error copy, 3 utility cards | `deliverables/product-mvp-slicing.md` | ✅ |
| QA | Top-5 edge-case hitlist + DnD acceptance criteria (mobile touch vs desktop mouse) | `deliverables/qa-edge-cases.md` | ✅ |

## Locked Decisions (planning lane)

- **Card editing:** direct inline edit on card body — card-catalog drawer REJECTED for MVP (v1.2 read-only CARD FILE).
- **Hopper behavior:** card physically moves into the Hopper; deck 8 / hopper 6 caps; FIFO; internal card drags only (external file drops = v1.1).
- **Routing:** sampled at FEED time; no-switch drop = gate-locked fault + auto-resume; mid-run flip = deferred to next card (snapshot semantics per QA EDGE-01).
- **CRT copy:** 11 verbatim strings (Product §2.4); faults red, phosphor green #33FF66 on #050805.
- **Model lineup (Research-verified, Mike-signed):** Claude 3.5 Sonnet RETIRED → **Claude Sonnet 5**; GPT-4o EOL → **GPT-5.4** (slug stays `gpt`); GLM-5.2 confirmed ($1.40/$4.40, value leader). Switchboard labels: CLAUDE / GPT-5.4 / GLM-5.2.
- **Architecture:** v2 SSE streaming function, `maxDuration 26` tier-agnostic (free clamps to 10s), 20s upstream / 25s client timeouts, mock fallback-only in prod (`MOCK_AI=false`, `ALLOW_MOCK_FALLBACK=true`), keys server-side only (never in PocketBase), PocketBase container on MJW platform.
- **Seed:** `default-cards.json` schema-fixed (added `prompt` + `favorite` per Architect schema; `token_estimate` is UI-only, stripped on import).
- **Hole grid:** 80-column ≥480px, 40-column fallback below.

## Sequencing & Dependencies

1. ✅ **Planning lane (DONE):** all 7 deliverables verified in `deliverables/`.
2. ⏸ **BUILD LANE GATED on Mike sign-off** of the 5 open items in `DAVE-BUILD-BRIEF.md` §8 (model display labels, Netlify plan tier, PocketBase hosting, mock-mode visibility, hopper external drops + 80-col fallback).
3. **Validation lane:** QA executes the protocol against Dave's first build; Art checks fidelity; DevOps deploys staging.
4. **Research → Architect handoff:** pricing/security findings are integrated via blueprint 🔌 IP-1..IP-5 slots (key vault, budget guards, redaction, CORS).

## Open Items for Mike — ✅ ALL RESOLVED (2026-08-12, "go with your recs")

1. Switchboard labels: **GPT-5.4** adopted; Claude pinned to `claude-sonnet-5`. ✅
2. Netlify plan: **tier-agnostic** — 26s config, 512 default max_tokens, streaming + mock. ✅
3. PocketBase hosting: **container on MJW platform**, CORS allowlisted. ✅
4. SIMULATION MODE: **fallback-only in prod**, dev-only toggle. ✅
5. Hopper external drops: **no (v1.1)**; hole grid: **40-col fallback <480px**. ✅

## Next Step After Sign-Off

🚀 **BUILD LANE LIVE — Dave dispatched 2026-08-12** to scaffold per `DAVE-BUILD-BRIEF.md` into `app/`. After Dave completes: QA lane executes the protocol against the first build, then DevOps deploys staging.

## Build Lane — ✅ COMPLETE (2026-08-12)
- Dave's first run timed out pre-code; second run produced the full app (rescued from sandbox into `app/`, `npm install` + `npm run build` verified clean by Bubbles).
- **App:** `app/` — 17 src files (~1.6k LOC), all 4 zones, mock-first SSE function, verbatim CRT copy, QA render strategy, seed cards, PWA shell. Compliance greps clean (zero supabase, zero dangerouslySetInnerHTML).
- **Handover:** `app/BUILD-HANDOVER.md` (file map, run instructions, mocked-vs-real, 8 known deviations for QA).

## QA Lane — ✅ COMPLETE + FIX PASS (2026-08-12)
- **QA-001 verdict: SHIP WITH KNOWN DEFECTS** — report: `deliverables/qa-execution-report.md`. EDGE-03/04/05 full PASS at code level; EDGE-01 snapshot semantics hold; EDGE-02 render strategy sound. Runtime: dev server 200, function mock path `meta→delta×9→done` verified; 405/400/204 envelopes pass.
- **Defects found:** DEFECT-01 (Sev2, pre-stream upstream failure → raw 500 — reproduced live with stale key), DEFECT-02 (Sev3, no user abort), DEFECT-03 (Sev3, no PB execution records), DEFECT-04 (double meta on mock path).
- **Fix pass (Dave):** DEFECT-01 → 502 JSON envelope; DEFECT-04 → single meta; DEFECT-02 → ABORT button + abortedRef guard (no fault window on user abort). All verified by Bubbles in canonical files + fresh build (new bundle hash index-Cd67djPd.js, ABORT marker compiled in).
- **DEFECT-03: PM decision — DEFERRED to v1.1** (Architect-gated `usage_log` collection; localStorage token accounting is MVP scope).
- **Open follow-ups:** real-device mobile pass for DND-09..16; local dev note — machine env has a stale `ZAI_API_KEY` (clear it or set `MOCK_AI=true` to force mock locally).
- **Next:** git init + first commit to `newM1k3` per DevOps checklist (grep secrets → git status → push) → Netlify staging deploy + env vars (Functions scope) → PocketBase container on MJW platform + `Prompts` schema + seed import → then v1.1 backlog (PB execution records, CARD FILE, external file drops, per-card pinning).
