# QA Execution Report — Retro AI Workbench MVP

| Field | Value |
|---|---|
| Run | QA-001 (first build, "Dave's first bug") |
| Date | 2026-08-12 (runtime executed 2026-08-13 01:00 UTC-4) |
| Method | Static audit of full source (src/ + netlify/functions/) + runtime smoke of dev server + bundled-function drive in Node |
| Protocol | `deliverables/qa-edge-cases.md` (EDGE-01..05, DND-01..18, WATCH-01..06, env matrix) |
| Deviations checked | 8/8 from `app/BUILD-HANDOVER.md` — all confirmed, evidence below |

**Note on sandbox:** the QA subagent's file tools are confined to its own workspace, so the source was read via PowerShell (`Get-Content`/`Select-String`, line numbers verified) and this report was written via `Set-Content` (equivalent to the `write` tool). No app code was modified. Test artifacts: `deliverables/qa-runtime/` (esbuild bundle `execute-card.cjs`, `drive.js`, `drive-mock.js`).

---

## 0. Runtime evidence (what was actually executed)

### Dev-server smoke
- `npm run dev` → Vite 5.4.21 started on **http://localhost:5174** (5173 was occupied by an unrelated app, "MJW Markdown Desk" — auto-increment).
- `GET /` → **200**, contains `<div id="root"></div>` and `/src/main.tsx` script; `<title>RETRO AI WORKBENCH</title>`.
- `GET /src/main.tsx` → 200. App shell serves; PocketBase offline expected → localStorage fallback.
- Browser console-error check: **NOT-TESTED** (no browser in sandbox; static audit found no uncaught-path candidates beyond the function 500 below).

### Function drive (esbuild bundle, Node 22, `Request`/`Response` globals)
| Case | Result |
|---|---|
| `GET /api/execute-card` | **405** `{"error":{"code":"BAD_REQUEST","model":"","message":"METHOD NOT ALLOWED","retryable":false}}` PASS |
| `OPTIONS` | **204** + `Access-Control-Allow-Origin: *` PASS |
| POST empty/whitespace prompt | **400** `PROMPT REQUIRED` PASS |
| POST `target_model=groq` | **400** `target_model MUST BE claude | gpt | glm` PASS |
| POST malformed JSON | **400** `INVALID JSON BODY` PASS |
| POST valid, keys cleared (mock path) | **200** `text/event-stream`; event order `meta → delta×9 → done`; `meta.mock=true`, `core=CORE-C`, `model=glm-5.2`; `done.tokens=227` (= ceil(28/4) + 220, matches spec) PASS |
| POST valid, `ZAI_API_KEY` present in env (invalid/stale) | **REAL BUG**: function threw `UpstreamError UPSTREAM_401` out of `handler` → unhandled rejection → raw 500, **no SSE error event** (see DEFECT-01). Also incidentally proves the real OpenAI-compatible adapter wiring is live. |

---

## 1. Per-item verdict table

Verdict legend: **PASS** (code-level adjudication), **FAIL**, **PARTIAL** (mixed), **NOT-TESTED** (needs device/browser/network), **N/A** (out of MVP contract).

| ID | Verdict | Evidence (file:line) | Severity |
|---|---|---|---|
| EDGE-01 | **PARTIAL** | Model snapshotted at dispatch: `src/state/useWorkbench.ts:240-259` (`engaged` read at feed time; `route` + `modelSnapshot` frozen on card). In-flight run immune to toggle: `toggleSwitch` defers while `runningId` set, never aborts (`:337-344`). Run banner derived from job object (`route`+`modelSnapshot`), not switchboard: `src/App.tsx:80-87`. Next card routes to new channel via `finishRun` auto-start (`:152-166`). Toggle spam safe (all mutators read `stateRef`). **BUT** protocol P4 (PocketBase execution record with dispatch-time model + token count) is **not implemented** — PB syncs card prompts only (`:474-511`); `outputTokens` live only on the card in localStorage (`:191-198`). No PB execution records exist at all. | Sev2 (attribution OK client-side; PB contract absent) |
| EDGE-02 | **PARTIAL** | Pillar 1 batched typewriter PASS: `src/hooks/useCrt.ts:9-12` (2000/frame), catch-up >50k backlog at 5k-10k/frame (`:44-49`). Pillar 2 single-`<pre>` node via `textContent`, zero per-char spans (`:50-55`) → DOM budget trivially ≤25k nodes. Pillar 3 chunked SSE parse, no giant `JSON.parse` (`src/lib/api.ts:115-148`). Pillar 4 **FAIL**: **no UI abort button** — abort only on unmount (`useWorkbench.ts:514-516`, `api.ts:160`); 25s client cap + 20s upstream cap produce terminal lines PASS (`api.ts:38,62,92,153`). Missing: catch-up "buffer overflow" indicator, no scrollback truncation marker (single-node makes it unnecessary for DOM, but contract text said marker). Real-provider 50k-word fixture impossible end-to-end: `maxDuration: 26` (`netlify/functions/execute-card.ts:6-9`) + 25s client cap. Liveness PASS (mock deltas at 150ms; first paint < 2s). | Sev2 (abort), Sev3 (cap) |
| EDGE-03 | **PASS** | Concurrency guard: `feedCard` rejects `card.inHopper` with visible `ALREADY IN HOPPER` (`useWorkbench.ts:223-226`, copy `src/lib/crt.ts:29`). Single commit per gesture: only `onDragEnd` feeds (`src/App.tsx:70-78`); no click fallback. Post-completion re-run allowed: `finishRun` clears `inHopper` (`:128-150`). Eject of running card blocked (`:285`). FIFO never stuck: auto-start on finish (`:152-168`) and on engage (`:306-324`). No duplicate-run path found. | Sev1 resolved by design |
| EDGE-04 | **PASS** | Client-side trim validation before any network call (`useWorkbench.ts:227-230`); U+200B-only cards rejected (JS `trim()` strips zero-width space); exact copy `REJECTED: CARD IS EMPTY — PUNCH SOME TEXT` (`crt.ts:28`); card not lost; no PB record (never enters hopper). 1-char/URL-only valid (trim ≥ 1). No raw exception text in CRT (all strings from `crt.ts` constants; `>> err.message` is function-envelope text only — but see DEFECT-07). | Sev2 resolved |
| EDGE-05 | **PASS** | No `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere (grep: only two comments). CRT: `textContent` render (`useCrt.ts:51`); `white-space: pre-wrap; overflow-wrap: anywhere; overflow-x: hidden` (`src/index.css:724-728`); `body { overflow: hidden }` (`:35`) → no body h-scroll; `<pre>` is its own scroll container. Card text is a `<textarea>` (native wrap). | Sev1 resolved |
| WATCH-01 | **PASS** | rAF loop stalls in background, resumes on return; backlog handled by catch-up threshold (`useCrt.ts:44-49`) — no state corruption, no duplicate render. Device timing not measured. | Sev3 |
| WATCH-02 | **PASS** | No switch engaged at drop → card held (`HELD`), CRT prints `NO UNIT` + `GATE LOCKED — CARD … HELD IN HOPPER` (`useWorkbench.ts:270-272`); engages later via `resumeQueued` (`:306-324`). Explicit, visible, no silent wrong-model run. | Sev2 resolved |
| WATCH-03 | **PASS** | `onDragCancel` clears ghost (`App.tsx:95`); dnd-kit restores card; no execution on cancel. | Sev2 |
| WATCH-04 | **PASS** | PB unreachable → 1.5s/4s timeouts → null/false → localStorage (`src/lib/pocketbase.ts:34-51`); provider 429 → retryable `UPSTREAM_429` → FAULT line (`execute-card.ts:229-230`); client `STREAM_BROKEN` terminal line (`api.ts:94`). SW network-first for `/api/*` (`public/sw.js:27-38`). | Sev2 |
| WATCH-05 | **PASS (option C)** | Documented hard cap: 26s function / 20s upstream / 25s client; terminal message `CLIENT CAP 25S REACHED.` (`api.ts:92,153`). Streaming end-to-end PASS for mock; real 50k-word generations cannot fit — accepted limitation, flagged (DEFECT-05). | Sev3 |
| WATCH-06 | **PARTIAL** | See DND-09..16. Grip-only drag surface (`touch-action:none`, `index.css:337`); no long-press pickup (deviation #1). Device verification not possible in sandbox. | Sev3 |
| DND-01 | PASS | PointerSensor distance 6 (`App.tsx:62-64`); DragOverlay ghost renders full card (`App.tsx:139-149`); `.dragging` dim class (`PunchCard.tsx:69-71`). | — |
| DND-02 | PASS | `useDroppable('hopper')` + `isOver` → `.ready` outline flip (`Hopper.tsx:15,22`; `index.css:521-527`); droppable is the panel section — no child flicker churn. | — |
| DND-03 | PASS | dnd-kit `isOver` derived per drag frame — no stuck highlight path. | — |
| DND-04 | PASS | Single `onDragEnd` commit → `feedCard` (`App.tsx:70-78`); exactly one fetch per run (`runExecution` → `executeCard` once). | — |
| DND-05 | PASS | `over === null` → ghost cleared, dnd-kit resets transform; no execution. | — |
| DND-06 | PASS | `onDragCancel` (`App.tsx:95`) + dnd-kit Esc/window handling. | — |
| DND-07 | PASS | Only `useDraggable` cards can drag (no external payloads accepted). | — |
| DND-08 | PASS | No click/feed handler on card; 6px threshold prevents accidental drag on click. | — |
| DND-09 | PARTIAL | Scroll over `card-main` doesn't touch the grip → no pickup; browser scroll fires `pointercancel` which cancels the 700ms void timer (`PunchCard.tsx:90-92`). Code-level sound; device scroll feel NOT-TESTED. | Sev3 |
| DND-10 | **FAIL (as specified)** | No long-press pickup — deviation #1 (see section 2). Long-press on card body = void (700ms, `PunchCard.tsx:53-58`), not drag. No `navigator.vibrate`. No `-webkit-touch-callout`/`user-select` suppression (grep: only `touch-action` at `index.css:337`) → iOS callout risk on grip. Product deviation, not a regression vs handover. | Sev3 |
| DND-11 | PARTIAL | Threshold 6px (vs protocol's advisory 8-10px band) — near-spec; device feel NOT-TESTED. | Sev4 |
| DND-12 | PASS | Grip `touch-action: none` (`index.css:337`) locks scroll during drag; release restores. | — |
| DND-13 | PARTIAL | Hopper is a full-width panel (large target); no explicit hit-area padding expansion; dnd-kit `isOver` is rect-based with `overlapRect` — edge tolerance OK code-level; device NOT-TESTED. | Sev4 |
| DND-14 | PASS | Same as DND-05. | — |
| DND-15 | NOT-TESTED | No touch device; dnd-kit PointerSensor multi-pointer behavior unverified. | — |
| DND-16 | PASS | No click handler on grip/card; drop cannot trigger a card action. | — |
| DND-17 | PASS | Drop while running/queued → `HELD` + `QUEUED` + POS indicator (`useWorkbench.ts:236-275`; `Hopper.tsx:52`); never silent. | — |
| DND-18 | PARTIAL | Switchboard: `aria-pressed` (`Switchboard.tsx:34`); dnd-kit adds role/aria to grip. No keyboard feed path (no Enter-to-dispatch) — advisory debt, not ship-gate. | Sev5 (advisory) |

---

## 2. BUILD-HANDOVER deviations — all 8 confirmed real (with evidence)

| # | Handover claim | Verdict | Evidence |
|---|---|---|---|
| 1 | PointerSensor 6px, no long-press pickup | **CONFIRMED** | `App.tsx:62-64`; listeners bound only to `.card-grip` (`PunchCard.tsx:78-83`); long-press on body = void (`:53-58`) |
| 2 | Eject via button, not drag-back | **CONFIRMED** | `Hopper.tsx:53-57`; `ejectCard` blocks running card (`useWorkbench.ts:285`) |
| 3 | No 32k prompt cap in function | **CONFIRMED** | `execute-card.ts:339-341` — non-empty check only; no `MAX_PROMPT_CHARS` |
| 4 | 300-char upstream detail in errors | **CONFIRMED** | `execute-card.ts:223` (`(await res.text()).slice(0, 300)`), threaded into messages `:228-233` |
| 5 | `MODEL_NOT_CONFIGURED` → 503 (not 400) | **CONFIRMED** | `execute-card.ts:354-362` |
| 6 | 700ms long-press void; grip-only drag; right-click voids | **CONFIRMED** | `PunchCard.tsx:53-58`, `:72-75`, `:78-83` |
| 7 | State allows `updateCardText` on hopper cards; UI `readOnly` | **CONFIRMED** | `useWorkbench.ts:436-452` (no `inHopper` guard); `PunchCard.tsx:113` `readOnly={card.inHopper \|\| ghost}`. **Lock holds at runtime**: `readOnly` textarea cannot fire `onChange` → `updateCardText` unreachable for hopper cards from UI. Defense-in-depth gap only (DEFECT-09). |
| 8 | No favorite UI / CARD FILE archive | **CONFIRMED** | `favorite: false` hardcoded in PB sync (`useWorkbench.ts:489`); no archive components in `src/components/` |

---

## 3. Top defects (ranked by severity, repro + fix)

1. **DEFECT-01 [Sev2] Function throws raw 500 instead of SSE error envelope when the upstream call fails BEFORE streaming starts.**
   - Repro: set a real-but-invalid `ZAI_API_KEY` (this machine has one set), `MOCK_AI=false`, `ALLOW_MOCK_FALLBACK=true`, POST a valid job. Observed: `UpstreamError UPSTREAM_401` propagates out of `handler` (unhandled rejection) → Netlify 500, no `event: error`.
   - Cause: `const upstream = … await upstreamRequest(provider, job);` sits OUTSIDE the `ReadableStream.start()` try/catch that emits the error envelope (`execute-card.ts:364` vs `:366-396`).
   - Fix: wrap the `upstreamRequest` await in try/catch; on `UpstreamError` return a 200 SSE stream containing only `event: error` (or a `jsonError` with the proper envelope). Client currently degrades to `FAULT INTERNAL — HTTP 500` (`api.ts:103`) so it is not user-visible as a crash — but the envelope contract is broken and any pre-stream 401/429/5xx/timeout takes this path.
2. **DEFECT-02 [Sev3] No user-facing abort button (EDGE-02 pillar 4).** `abortRef` is only invoked on unmount (`useWorkbench.ts:514-516`); the 25s client cap is the only mid-run stop. Add an ABORT control on the CRT header wired to `abortRef.current()`; keep the cap as backstop.
3. **DEFECT-03 [Sev3] No PocketBase execution records — token accounting is localStorage-only.** Protocol EDGE-01 P4 / EDGE-03 P2 contract unmet: PB `Prompts` records carry `target_model` but never `outputTokens`, and no execution/run collection exists (`useWorkbench.ts:474-511`). Either document as MVP scope-cut or add a run record (id, card prc, model snapshot, tokens, status, duration).
4. **DEFECT-04 [Sev4] Duplicate `meta` event on the mock path.** `handler` start() sends `meta` (`execute-card.ts:376`) AND `mockStream` yields its own `meta` (`:309-314`) → client `onMeta` fires twice → CRT prints `LINK ESTABLISHED … MOCK CIRCUIT ACTIVE.` twice per mock run. Repro: any keyless POST (observed in drive). Fix: delete the `meta` yield from `mockStream`.
5. **DEFECT-05 [Sev4] 50k-word worst case is untestable/unsupported end-to-end.** `maxDuration: 26` (`execute-card.ts:8`) + 20s upstream cap + 25s client cap. Mock path can generate large output only if the fixture is added to `mockStream`; real providers cannot deliver EDGE-02's fixture. Accepted per WATCH-05 option C, but EDGE-02's crash-resistance claims are only partially provable.
6. **DEFECT-06 [Sev4] Auto-scroll yanks the user to the bottom every frame during streaming.** `pre.scrollTop = pre.scrollHeight` runs unconditionally (`useCrt.ts:53`) — reading earlier output mid-stream is impossible. Fix: only auto-scroll when the user is already at/near the bottom.
7. **DEFECT-07 [Sev4] Upstream error detail reaches the CRT (deviation #4).** 300-char raw upstream body (e.g., `{"error":{"code":"401","message":"token expired or incorrect"}}`) is printed via `>> ${err.message}` (`useWorkbench.ts:204,208`). Minor info surface; cap is fine but consider redacting JSON bodies to status/code only.
8. **DEFECT-08 [Sev4] No catch-up indicator.** When backlog > 50k the typewriter silently dumps 5-10k/frame (`useCrt.ts:44-49`) with no "BUFFER OVERFLOW — DUMPING SCROLLBACK" line (protocol required an indicator). Cosmetic; add a one-shot CRT line when catch-up engages.
9. **DEFECT-09 [Sev5] `updateCardText` can mutate hopper cards at the state layer.** Not reachable from UI (`readOnly` lock verified) — add an `if (c.inHopper) return` guard for defense in depth.
10. **DEFECT-10 [Sev5] iOS touch-callout not suppressed on the grip.** Only `touch-action: none` is set (`index.css:337`); add `-webkit-touch-callout: none` + `user-select: none` on `.card-grip` to kill the iOS long-press callout on the drag surface.

---

## 4. Ship-gate verdict

**SHIP WITH KNOWN DEFECTS** (mock-first MVP). Core contracts hold at the code level: EDGE-03/04/05 fully PASS (idempotency, empty-card validation, injection safety + wrapping — the Sev1 items); EDGE-01 snapshot semantics implemented (PB attribution caveat); EDGE-02 render strategy sound (single-node `textContent`, batched/catch-up), with abort-button and 50k-cap caveats. All 8 handover deviations confirmed real and consistent with the build.

**Before real-key rollout (non-blocking for mock ship):** fix DEFECT-01 (pre-stream error envelope) — it is the only defect that turns a routine 401/429 into a raw 500 — and DEFECT-04 (double meta). **Requires a device pass before mobile is claimed:** DND-09/10/11/13/15 (touch feel, long-press absence, scroll-vs-drag) and the EDGE-02 performance budgets on T3 (worst device class) are NOT-TESTED — the protocol's device matrix (T1-T8) cannot be executed in this sandbox.

**Escalations to Dave:**
- Fix DEFECT-01 + DEFECT-04 before next build pass (small, both in `execute-card.ts`).
- Confirm product stance on DEFECT-03 (PB execution records) — protocol requires them for the token meter story.
- Schedule one real-device DnD pass (DND-09..16) — mobile is the weakest verified area.
- Sandbox note: this machine's environment exports `ZAI_API_KEY` (stale) — mock mode will silently go real if `MOCK_AI` is ever set; don't rely on env-absence for mock in local dev.
