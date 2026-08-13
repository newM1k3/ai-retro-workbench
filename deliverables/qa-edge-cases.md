# Retro AI Workbench — QA Pre-Implementation Protocol: Edge-Case Hitlist & DnD Acceptance Criteria

| Field | Value |
|---|---|
| Document | `qa-edge-cases.md` |
| Author | QA (subagent) |
| Date | 2026-08-12 |
| Status | **PRE-IMPLEMENTATION** — write-first protocol. To be executed verbatim against the first build ("Dave's first bug"), then re-run on every regression. |
| Scope | (1) Top-5 edge-case hitlist with expected behavior + PASS/FAIL criteria; (2) Drag-and-drop acceptance criteria: desktop mouse vs mobile touchscreen |
| Stack under test | React 18 + Vite + TypeScript PWA · Netlify · PocketBase · LLM switchboard: Claude / GPT-4o / GLM-5.2 |
| Bug ID scheme | `EDGE-01…EDGE-05`, `DND-01…`, `WATCH-01…` (watchlist). File as: `[ID] title — repro steps — actual vs expected — env — severity` |

---

## 0. How to use this protocol

### 0.1 Test environment matrix (every edge case runs on every cell unless marked device-specific)

| # | Environment | Notes |
|---|---|---|
| T1 | Desktop Chrome (latest, Windows + macOS) | Primary target; DevTools Performance/Network/Heap available |
| T2 | Desktop Firefox + Safari (macOS) | DnD event parity check |
| T3 | Mobile iOS Safari 16+ (iPhone SE-class or older device preferred) | Weakest device class = worst case for EC-02 |
| T4 | Mobile Android Chrome 110+ (mid-range, e.g., Moto G / Pixel 4a-class) | `navigator.vibrate` supported; long-press context menu risk |
| T5 | PWA installed (add-to-homescreen) vs plain browser tab | App-shell behavior, offline, background throttling |
| T6 | Localhost (Vite dev) + Netlify deploy preview + Netlify prod | Serverless timeout/streaming behavior differs |
| T7 | Network: Fast 4G, "Slow 3G", and Offline | Streaming backpressure, error surfaces |
| T8 | PocketBase: local dev instance + deployed instance | Record integrity checks |

Instrumentation baseline: browser console open, Network tab, Performance tab (FPS meter + long-task recording), Chrome `PerformanceObserver('longtask')`, heap snapshots (`Performance.memory` in Chrome), React Profiler (dev builds only), PocketBase collection inspector.

**Precondition for all tests:** model outputs are deterministic fixtures (see EC-02 fixture spec) — never real model calls for perf/edge testing, except a smoke pass of one real call per model.

---

## 1. The Edge-Case Hitlist (Top 5)

### EDGE-01 — User drops a card into the Hopper, then toggles the Switchboard to a different model **mid-execution**

**Severity: Sev1 (data/attribution integrity + trust).** Every execution writes a record with a model field; wrong attribution corrupts the token meter and erodes user trust in the "mechanical" fantasy of the UI.

**Scenario.** User drops "Analyze the 1984 sales memo" into the Hopper. Claude starts executing and the CRT begins streaming. 2 seconds in, the user flips the Switchboard to GLM-5.2. Then they drop a second card. What happens?

**Expected behavior — RECOMMENDED CONTRACT (snapshot-at-dispatch semantics):**
The Switchboard selects the model for the **next** execution, not a live knob on the current one.

1. The model is snapshotted at the moment the card commits into the Hopper ("dispatch time"). The in-flight execution runs to completion under that snapshot, untouched.
2. The CRT must display a **run banner that is independent of the switchboard position**: `RUNNING · Claude` (dispatch-time model) while the switchboard UI may show GLM-5.2. This dual state is deliberate, not a bug — both must be visible simultaneously so the user understands.
3. The second card dropped after the toggle executes under GLM-5.2 (current switchboard position at its dispatch time), queued behind the first if a queue exists.
4. Toggling during any phase (streaming, buffered-complete, queued, idle) never throws, never blanks the CRT, never aborts the in-flight job.
5. The execution record in PocketBase persists `model = <dispatch-time model>` + token count; accounting attributes tokens to that model.
6. Rapid toggle spam (10 flips in 1 s) is harmless: no stale-closure bugs, no double-dispatch, no React StrictMode double-render artifacts.

**Pass criteria (all must hold):**
- P1. CRT stream is a single contiguous output from the dispatch-time model; no interleaving, no duplicate tokens, no mid-stream model switch.
- P2. Run banner shows the dispatch-time model even while switchboard shows the other model.
- P3. Next drop executes under the *current* switchboard model.
- P4. PocketBase record: `model` == dispatch-time model; token count matches the provider response exactly once.
- P5. Network tab shows exactly one LLM stream connection per execution (no aborted + restarted duplicates).
- P6. Zero uncaught exceptions in console; toggle latency < 50 ms.

**Fail criteria (any one = FAIL, file as EDGE-01):**
- F1. Stream switches models mid-answer, or output interleaves two models.
- F2. Execution record/accounting attributes tokens to the wrong model.
- F3. Toggling aborts, blanks, or freezes the CRT.
- F4. Double network call or duplicate PocketBase record for one card drop.
- F5. Any uncaught exception or React key/stale-state warning on toggle.

**Implementation guardrails (what the code must guarantee before this test can pass):**
- Model selection captured in a ref/state at dispatch time and frozen into the job object; the async stream handler must never read the live switchboard state after dispatch.
- AbortController scoped per execution; toggle path must not touch it.
- Run banner derived from job object, not from switchboard state.

**Product decision needed (open question Q4):** if product instead wants *live-switch* semantics (abort current job, mark CANCELLED with partial output + consumed tokens, never auto-resume), the criteria flip: P1/P2/P3 become "abort ≤ 500 ms, record marked CANCELLED with partial text preserved and tokens counted, no automatic re-dispatch". Default = snapshot semantics above.

---

### EDGE-02 — GLM-5.2 returns a **50,000-word** response to the CRT terminal: does the tab crash?

**Severity: Sev1 (hard crash / freeze = total feature loss).**

**Scale reality-check.** 50,000 words ≈ 300,000–330,000 characters ≈ ~300 KB of text, ~65k–75k tokens, and — if naive per-character typewriter setState is used — **~300,000 React renders of a growing DOM string**, i.e., O(n²) DOM work plus hundreds of thousands of discarded frames. This is a guaranteed tab freeze/crash path, not a theoretical one.

**Expected behavior — required render/performance strategy (all four pillars):**

1. **Character-budget streaming (typewriter pacing with catch-up).**
   - Never per-character setState. Append in chunk batches, max **2,000 chars per animation frame** during "typewriter" mode.
   - When the unrendered buffer exceeds the budget (backlog > 50,000 chars), the typewriter **collapses into catch-up dump mode**: append the backlog in 5,000–10,000-char chunks per frame until the buffer is drained, then optionally resume light pacing. The CRT shows a mechanical "buffer overflow — dumping scrollback" indicator. Animating 300k chars at human reading speed would take hours; catch-up is mandatory, not optional.
   - First paint of output ≤ 2,000 ms from drop; output grows monotonically while state = streaming (a "wait for the whole response then dump" implementation is an automatic FAIL of the streaming requirement).

2. **Bounded / virtualized CRT scrollback (terminal semantics).**
   - Render a **flat array of line segments**, not a nested span tree. Render only the viewport-visible window of segments (virtualized), or, if virtualization is skipped, enforce a hard DOM budget: keep the last **10,000 lines** (≈50k words fits; anything beyond is pruned with a terminal-style marker: `— scrollback truncated: 2,401,888 chars —`).
   - Hard cap on rendered DOM nodes: **≤ 25,000 nodes** at all times. Per-character `<span>` rendering = automatic FAIL regardless of measured performance.
   - Text lives in a single `<pre>`-style monospace node written via `textContent` (React-escaped), with `overflow-wrap: anywhere` (see EDGE-05).

3. **Memory ceiling.**
   - The raw JSON response buffer is parsed and **discarded as it is consumed** (streaming parse / chunked read), never retained whole beyond necessity.
   - Heap snapshot delta 30 s after full delivery: **≤ 200 MB desktop, ≤ 250 MB mobile**. > 300 MB = FAIL (GC thrash / OOM risk on mobile).

4. **Abort + timeout as first-class UX.**
   - Client-side abort button works ≤ 500 ms after tap at any point.
   - Client request timeout (e.g., 120 s) with graceful terminal message; provider/function timeout must be handled as a *terminal line*, not an error wall (see open question Q1 re: Netlify function limits).

**Pass/fail thresholds (measured, not vibes):**

| Metric | PASS | FAIL |
|---|---|---|
| Tab survival | Page remains interactive throughout and after delivery; user can scroll to top, scroll to bottom, copy, abort | Tab unresponsive > 5 s continuously, or crashes/reloads |
| Long tasks (desktop) | After the initial catch-up burst, no single long task > 250 ms during steady streaming | Sustained long tasks > 250 ms during steady state |
| Long tasks (mobile) | No single long task > 1,000 ms outside the initial burst; no jank spiral | Frames stall > 1,000 ms repeatedly after delivery |
| Memory | Heap delta ≤ 200 MB (desktop) / ≤ 250 MB (mobile) at 30 s post-delivery | > 300 MB, or forced GC thrash visible as repeated sawtooth |
| DOM budget | ≤ 25,000 nodes; line-windowed rendering | > 25,000 nodes, or any per-character spans |
| Frame rate | ≥ 30 fps desktop / ≥ 20 fps mobile during typewriter phase; ≥ 15 fps during catch-up dump | Sustained below thresholds, or white-flash gaps when scrolling |
| Streaming liveness | First output paint ≤ 2,000 ms from drop; monotonic growth | Whole-response buffering before paint; frozen "streaming" state |
| Abort | Works ≤ 500 ms from tap at any phase | Abort hangs; stream keeps rendering |

**Test procedure.** Inject a deterministic fixture: a generated 50,000-word text (mixed: paragraphs, one 10,000-char unbroken string, emoji, `<script>`-looking text — see EC-05) served from a local mock of the GLM-5.2 endpoint through the app's real request path (T1–T4, T6). Record: heap snapshots at t0 / mid-stream / +30 s; long-task trace; FPS meter; scroll test on the fully rendered output. Repeat on T3 (worst device class). Budgets relax 2× on mobile where noted.

**Implementation guardrails:** rAF-driven batched appends (or `queueMicrotask` bursts with yield points); line-segment array + windowed render; request streaming (SSE/chunked) end-to-end — client → (Netlify function?) → provider; never `JSON.parse` of a giant body held whole.

---

### EDGE-03 — Double-dropping the same card (idempotency + rapid re-execution)

**Severity: Sev2 functionally, Sev1 on cost** (a paid LLM double-fired = real money + duplicate records).

**Scenario A — concurrent double-drop:** user drops card A, and while it is queued/running, drops the *same card instance* again (or a drag ghost is dropped twice in one gesture).
**Scenario B — rapid re-execution:** card A completes; user drops it again immediately (this is legitimate re-run *after* completion).

**Expected behavior:**
1. **Concurrency guard:** the same card *id* may be queued/running **only once** at a time. A second drop while it is active is **rejected with visible feedback** — Hopper stamps `ALREADY IN HOPPER — A is running` — and creates **no second job**. The card is not lost.
2. **Post-completion re-run is allowed:** once the execution record is terminal (COMPLETED/FAILED/CANCELLED), dropping the same card starts a *fresh* execution with a new id.
3. **Double-fire protection on the drop itself:** a single gesture (dragend + pointerup, or touch: pointerdown→move→up) must commit **exactly one** job. A commit-lock per card id prevents duplicate submissions from racing event handlers.
4. **Queue semantics (requires product sign-off, Q2):** default = single active job + FIFO queue; Hopper displays queue depth. Reordering or concurrent runs are out of contract unless explicitly specified.

**Pass criteria:**
- P1. Network tab: exactly **one** LLM request for the duplicate drop scenario.
- P2. Exactly one PocketBase execution record per accepted drop; rejected drops create none.
- P3. Visible rejection feedback (Hopper/CRT line) on the second concurrent drop; card returns to deck.
- P4. Re-dropping after completion creates a new record with a new execution id and runs normally.
- P5. Queue state machine (IDLE → QUEUED → RUNNING → COMPLETED) never gets stuck; dropping during QUEUED/RUNNING cannot reorder or duplicate.

**Fail criteria:**
- F1. Two API calls or two records for one gesture / one concurrent duplicate.
- F2. Interleaved outputs from two runs of the same card in one CRT session.
- F3. Card vanishes (neither queued nor returned) on rejected drop.
- F4. Queue stuck (second card never runs) after any sequence of drops.
- F5. Double-submit race: both `drop` and a fallback click handler fire → duplicate execution.

**Test steps:** rapid double-drop (2 gestures < 1 s apart); drop while RUNNING; drop while QUEUED behind another card; drop again immediately after COMPLETED; verify network + PocketBase records after each.

---

### EDGE-04 — Dropping an empty card (blank / whitespace-only / zero-width)

**Severity: Sev2 (validation UX + wasted paid calls + confusing terminal output).**

**Scenario.** User punches a card with no text: empty body, whitespace-only, single newline, zero-width space (U+200B), or only invisible characters. Card is dropped into the Hopper.

**Expected behavior:**
1. **Client-side validation before any network call:** trimmed length of the prompt must be ≥ 1 character. Empty ⇒ card is rejected at the Hopper with a mechanical-flavored but *clear* terminal line: `REJECTED: CARD IS EMPTY — PUNCH SOME TEXT`. No LLM request is fired.
2. Card is not lost: it returns to the deck (desktop) or remains in hand (mobile) with the rejection feedback visible.
3. No PocketBase record is created for a rejected drop.
4. Boundary handling: a card containing only a URL or a single character is **valid** (≥ 1 char after trim); a card containing only whitespace/newlines/zero-width chars is **invalid**. Prompt text is trimmed of leading/trailing whitespace at dispatch (document that transformation).
5. No raw exception text is ever surfaced to the CRT (no `Error: prompt is required` leaks).

**Pass criteria:**
- P1. Network tab: zero requests fired for empty/whitespace/zero-width cards.
- P2. Hopper/CRT shows the rejection message; card returns to deck.
- P3. No PocketBase record for rejected drops.
- P4. 1-char and URL-only cards execute normally (smoke: one request each).
- P5. No uncaught exceptions; console clean.

**Fail criteria:**
- F1. Empty prompt reaches the provider (network evidence) — wasted paid call.
- F2. Uncaught error, error wall, or raw exception text in CRT.
- F3. Card silently vanishes.
- F4. Validation rejects valid 1-char / URL-only cards (over-strict trim).

---

### EDGE-05 — Long unbroken strings break the layout (and open an injection surface)

**Severity: Sev1 if XSS-adjacent, Sev2 for pure layout.** The CRT renders model output and the cards render user text — both are untrusted input echoed back. This is the class of bug that turns a brutalist aesthetic into a broken page.

**Scenarios.** (a) Output contains a 10,000-char unbroken string (URL, base64 blob, minified code line); (b) card text or output contains HTML/script-looking content: `<img src=x onerror=alert(1)>`, `<script>…</script>`, markdown that a naive renderer might interpret.

**Expected behavior:**
1. **Wrapping:** CRT and card text use `overflow-wrap: anywhere` (or `word-break: break-word`) in the monospace terminal. Unbroken strings wrap; the **document body never scrolls horizontally** at any viewport ≥ 320 px wide.
2. **No content escape:** the `<body>` `scrollWidth` never exceeds `clientWidth` (measure, don't eyeball). Overflow is contained inside the CRT's own scroll container, which scrolls vertically (and horizontally *only within* the terminal pane if wrapping is impossible — but wrapping is the requirement).
3. **Injection safety (hard rule):** model output and card text are rendered as **text only**. No `dangerouslySetInnerHTML` on any model/user-derived string, ever. If markdown rendering is added later, it must go through a sanitization pipeline (e.g., DOMPurify) with default-deny — until then, plain text. A pasted `<img onerror>` card, executed, must appear as literal text.
4. **Streaming stability:** appending the long string chunk-by-chunk during streaming causes no reflow jank beyond EDGE-02 budgets (wrap-aware chunk boundaries preferred: don't cut mid-grapheme cluster — use `Intl.Segmenter` or surrogate-pair-safe slicing).

**Pass criteria:**
- P1. `document.body.scrollWidth <= document.body.clientWidth` at 320 / 375 / 768 / 1280 px widths with a 10,000-char unbroken string rendered in CRT and in a card.
- P2. Long string fully visible (wrapped) via vertical scroll; no clipped characters.
- P3. Injection fixture executes nothing: no dialog, no network request, no console error. Rendered output contains the literal text.
- P4. No horizontal scrollbar appears on the page in any of T1–T4.
- P5. Chunked streaming of the long string stays within EDGE-02 frame-rate budgets.

**Fail criteria:**
- F1. Body-level horizontal scroll or layout overflow (element wider than viewport).
- F2. Text clipped / unreadable without horizontal scroll inside the CRT.
- F3. ANY script execution from pasted HTML content (XSS = Sev1, ship-blocking).
- F4. Broken rendering mid-string (mojibake, cut surrogate pairs / emoji).
- F5. Reflow jank spikes beyond EDGE-02 long-task budgets while the string streams in.

**Test fixture:** deterministic output including: `https://example.com/` + 9,900 chars, a base64 blob line, `<img src=x onerror=alert(1)>`, `<script>alert(2)</script>`, emoji + RTL text, `a`.repeat(10000).

---

### Secondary watchlist (must test, not top-5)

| ID | Scenario | Why it bites | Minimal pass bar |
|---|---|---|---|
| WATCH-01 | Tab-switch during streaming (PWA background) | rAF/setTimeout throttled in background tabs → typewriter stalls; on return must catch up, not explode (see EDGE-02 catch-up mode) | Return-to-tab resumes stream ≤ 1 s, no state corruption, no duplicate render |
| WATCH-02 | No model engaged at drop time (if switchboard can be empty) | Ambiguous dispatch; must define: disable Hopper + show `SWITCHBOARD: NO LINE` vs auto-pick default | Explicit defined behavior + visible feedback; no silent wrong-model run |
| WATCH-03 | Drag released outside the window / Esc during drag | dragend fires without drop; card must restore | Card returns to deck; no execution; no stuck ghost |
| WATCH-04 | Offline / PocketBase down / provider 429 + timeout | PWA + serverless stack has many failure layers | Graceful terminal lines, retry affordance, no error wall, no lost card |
| WATCH-05 | Netlify function timeout on long generations | Sync functions cap ~10 s; a 50k-word generation takes minutes | Streaming responses end-to-end or background function; else documented hard cap with terminal message (ties to Q1) |
| WATCH-06 | Mobile scroll-vs-drag conflict | Core mobile DnD hazard, covered in section 2 | See DND-07/08 below |

---

## 2. Acceptance Criteria — Drag-and-Drop: Mobile Touch vs Desktop Mouse

Preconditions: console open; no extensions interfering; test at 100% zoom; card deck contains ≥ 6 cards; Hopper present and empty. Each item: **test action → PASS / FAIL**. A build is not shippable until every item marked with ⛔ FAIL is resolved; items marked ⚠️ are advisory (no gate).

### 2.1 Desktop (mouse) — native HTML5 DnD (`dragstart` / `dragover` / `drop` / `dragend`)

| ID | Test action | PASS | FAIL (⛔ gate unless ⚠️) |
|---|---|---|---|
| DND-01 | Press mouse on card, move > 3 px, release outside any target | `dragstart` fires on mousedown+move; a recognizable card ghost (snapshot or styled element) follows the cursor; card visually dims | No drag starts; ghost is invisible/blank; card doesn't dim |
| DND-02 | Drag card over the Hopper and hold | Hopper enters highlighted state (brutalist color/border/pattern flip) within 100 ms of hover; highlight persists with zero flicker while over it | No highlight; flicker (dragenter/dragleave churn on nested children); highlight appears with a non-card payload |
| DND-03 | Drag card over Hopper, then out, then back in | Highlight follows cleanly: off when out, on when in; no stuck highlight after leaving | Highlight stuck on after leaving; missing on re-entry |
| DND-04 | Drop card inside Hopper | Single `drop` commit; card removed from deck (or marked `IN HOPPER`); execution starts; exactly one network call + one PocketBase record (Network tab + DB check) | Double-fire (2 calls/records); no reaction; Hopper flashes but card not accepted |
| DND-05 | Drop card **outside** the Hopper (deck area, margins, between cards) | No execution; card returns to original deck position (no layout shift of neighbors); no error toast; console clean | Card disappears; execution starts; cards rearrange; error thrown |
| DND-06 | Press Esc mid-drag, and drag out of the window and release | `dragend` restores card to deck; no stuck ghost; no execution | Stuck ghost; card lost; execution fired |
| DND-07 | Drag a non-card element over the Hopper (text selection, image) | Hopper ignores it; no highlight; no drop acceptance | Highlight/accept of invalid payload |
| DND-08 | Double-click a card (not a drag) | No drag, no drop, no execution (click reserved for card actions) | Double-click triggers accidental execution |

### 2.2 Mobile (touchscreen) — Pointer Events / long-press pick-up

Native HTML5 DnD does **not** work on touch; contract assumes Pointer Events (or a compliant lib such as `@dnd-kit/core` pointer sensor). Items tested on T3 (iOS Safari 16+) and T4 (Android Chrome 110+).

| ID | Test action | PASS | FAIL (⛔ gate unless ⚠️) |
|---|---|---|---|
| DND-09 | Vertical flick scroll over the deck (no long-press) | Page scrolls freely at native velocity; no card picks up; no haptic | Cards grab during scroll; scroll is blocked/janky |
| DND-10 | Long-press a card (~250–300 ms, finger still) | Card lifts (visual raise + `navigator.vibrate(10)` on Android ⚠️); page stops scrolling; card follows finger thereafter | Long-press never engages; tap immediately drags; Android context menu pops (must be suppressed: `user-select:none`, `-webkit-touch-callout:none`, `contextmenu` preventDefault during press) |
| DND-11 | Drag threshold: long-press, then move 5 px vs 15 px | Movement < ~8–10 px = still "hold" (no drag state); ≥ ~8–10 px = drag engages. Threshold must prevent accidental drags during normal taps | Drag engages on tiny movements (breaks taps); or requires huge movement (feels dead) |
| DND-12 | Scroll-vs-drag conflict: long-press, drag toward a scrollable area, then release | While dragging, page scroll is locked (`touch-action: none` / preventDefault scoped to drag only); release restores scrolling; no scroll jump on pickup or release | Page scrolls during drag (card "flies away", drop lands wrong); scroll position jumps on release |
| DND-13 | Drop accuracy on small targets: drag card to Hopper, release with finger overlapping Hopper edge | Drop accepted when finger/render-rect intersects the **expanded** Hopper hit area (≥ 16 px padding; total touch target ≥ 44×44 CSS px per WCAG 2.5.5); highlight shows the moment the dragged card overlaps the Hopper (no hover on touch — visual targeting is required) | Pixel-perfect landing required; drop rejected at edges; no targeting highlight while over Hopper |
| DND-14 | Release outside Hopper (mid-deck, on CRT, on margin) | Card returns to deck; no execution; no error; no stuck ghost | Card lost; execution fired; ghost stuck |
| DND-15 | Multi-touch: second finger lands during a drag | Clean behavior: drag either continues with first pointer or cancels; no duplicate drop events, no crash | Duplicated drops (2 executions); ghost corruption; jank |
| DND-16 | Tap after drag (click suppression) | Dropping a card does **not** also fire the card's tap action (e.g., open/edit); synthetic click suppressed when movement exceeded threshold | Drop triggers card open/edit/execute — double action |
| DND-17 | Drop while an execution is running (queue active) | Card either queues with visible queue-depth feedback or is rejected with clear feedback (per EDGE-03 contract); never silently dropped | Card vanishes; duplicate run; queue stuck |
| DND-18 | Accessibility smoke ⚠️ | Hopper and each card expose accessible names/roles; keyboard alternative exists or is explicitly scheduled (ARIA + focusable + Enter-to-dispatch) | No keyboard path at all and none scheduled (PWA a11y debt — advisory, not ship-gate) |

### 2.3 Cross-platform parity notes (record in every DnD test run)

- Same card-deck fixture and same gesture script on T1 and T3/T4; record side-by-side outcomes.
- iOS Safari quirk: `navigator.vibrate` unavailable — haptics are Android-only (⚠️, not a fail).
- Event-order audit (desktop): `dragstart → dragover(preventDefault!) → drop → dragend` — a `drop` that never fires while `dragover` wasn't prevented is the #1 "Hopper ignores card" root cause; the test harness must log event sequence on every drop.
- Children of the Hopper must be `pointer-events: none` (or dragenter/dragleave counted) to kill highlight flicker (DND-02).

---

## 3. Cross-cutting notes & open questions (need answers before build complete)

1. **Q1 — LLM transport:** Does the app call providers (a) directly from the client, (b) via PocketBase, or (c) through a Netlify Function? This decides whether a 50k-word GLM-5.2 response is even *feasible* (sync Netlify functions ~10 s cap vs minutes of generation) and where the API key lives. Streaming (SSE/chunked) end-to-end is mandatory for EDGE-02 regardless — confirm the chosen path supports it.
2. **Q2 — Execution model:** Is concurrency strictly one active job + FIFO queue (recommended), or are parallel runs allowed? This pins the EDGE-01 and EDGE-03 contracts and the queue-state machine.
3. **Q3 — CRT scrollback policy:** Is pruning old lines with a truncation marker acceptable (recommended, terminal-style), or must the full 50k-word output remain browsable/exportable? If export is required, spec a "save scrollback" affordance.
4. **Q4 — Switchboard semantics:** Confirm EDGE-01 snapshot-at-dispatch (recommended) vs live-abort semantics — see product decision note under EDGE-01.
5. **Q5 — Markdown/rendering:** Is CRT output ever markdown-rendered? If yes, sanitization pipeline is a ship-blocking requirement (EDGE-05). Default until told otherwise: plain text only.
6. **Q6 — DnD library:** Acceptable to use `@dnd-kit/core` (pointer sensor) for touch, or must DnD be hand-rolled Pointer Events? Affects DND-09…16 test interpretations.
7. **Q7 — Empty switchboard state:** Can the Switchboard have no active model, or is one always engaged? See WATCH-02.

---

*End of protocol. Execute against first build; every EDGE-01…05, DND-01…17, and WATCH-01…06 item must be triaged to PASS or a filed bug before the "brutalist" aesthetic is allowed to ship.*
