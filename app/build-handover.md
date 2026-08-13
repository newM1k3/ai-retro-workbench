# Retro AI Workbench — BUILD HANDOVER

**Built by:** Dave (2 runs; completed in run 2, verified + rescued by Bubbles) · **Date:** 2026-08-12
**Location:** `projects/retro-ai-workbench/app/` · **Status:** BUILD PASSES (`npm run build` clean, tsc + vite) — QA lane next

## What was built (MVP complete)
A React 18 + Vite + TS PWA with the 1980s analog workbench: Switchboard (CLAUDE / GPT-5.4 / GLM-5.2), Punch Card Deck (2×4, 8 slots), Hopper (FIFO, cap 6), CRT terminal (typewriter streaming). Mock-first: works with zero API keys; real providers plug in via Netlify env vars.

## File map
```
app/
├── netlify.toml, .env.example, .gitignore        # DevOps configs
├── netlify/functions/execute-card.ts             # v2 SSE function (mock-first, keys server-side)
├── public/  manifest.webmanifest, sw.js, icon.svg
├── src/
│   ├── App.tsx                # DndContext (PointerSensor, 6px), audio init, PB probe, M-key mint
│   ├── main.tsx               # StrictMode + SW registration (prod only)
│   ├── index.css              # full brutalist token system (all locked hex values)
│   ├── components/  Switchboard, Deck, PunchCard, Hopper, CrtTerminal
│   ├── state/useWorkbench.ts  # deck⇄hopper⇄CRT state machine, persistence, PB sync
│   ├── hooks/useCrt.ts        # batched typewriter (≤2k chars/frame, catch-up >50k backlog)
│   ├── lib/  types, crt (verbatim copy strings), api (SSE client, 25s cap), pocketbase, fx (Web Audio)
│   └── data/  default-cards.json (5-card seed), templates.ts (3 utility templates)
```

## How to run
```
cd projects/retro-ai-workbench/app
npm install            # done
npm run dev            # http://localhost:5173 (PocketBase offline → localStorage fallback)
netlify dev            # to exercise /api/execute-card (mock mode, no keys needed)
npm run build          # production build (verified passing)
```
Env: copy `.env.example` → `.env`; set `VITE_POCKETBASE_URL`; API keys go to Netlify dashboard with **Functions** scope only (never VITE_).

## Mocked vs real
- **Mock:** all 3 providers when their key is absent (`ALLOW_MOCK_FALLBACK=true` default) — canned retro transmission, ~9 deltas at 150ms.
- **Real:** Anthropic (x-api-key), OpenAI + Z.ai (Bearer) streaming adapters wired; switch to live by setting keys + `MOCK_AI=false`.
- **PocketBase:** graceful degradation — reachability probe; writes sync best-effort, fall back to localStorage.

## Known deviations / things QA should scrutinize
1. **Mobile DnD:** PointerSensor with 6px activation distance — no long-press pick-up. Touch scroll-vs-drag conflict unverified (QA DND-09/10/12).
2. **Hopper eject:** via EJECT button on the hopper card, not drag-back-to-deck (Product's spec gesture). Functionally equivalent; verify.
3. **No `MAX_PROMPT_CHARS` (32k) guard** in the function (prompt only validated non-empty).
4. **Upstream error detail** (300-char slice) forwarded in error messages — minor deviation from strict redaction.
5. `MODEL_NOT_CONFIGURED` returns **503** (blueprint said 400).
6. **Long-press void = 700ms** on card body (right-click also voids); grip zone is the only drag surface.
7. State layer allows `updateCardText` on hopper cards, but UI forces `readOnly` — verify lock holds at runtime.
8. No per-card `favorite` UI, no CARD FILE archive (both v1.1/v1.2 per scope cuts).

## For the next build pass
- QA report defects → Dave fixes → re-run build + QA.
- Then DevOps: deploy to Netlify (staging on MJW platform), set env vars with Functions scope.
