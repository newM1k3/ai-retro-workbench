# PRODUCT — MVP Slicing & Integration Spec
## Retro AI Workbench

**Deliverable:** Product → MVP feature slice, routing integration logic, default utility cards
**Date:** 2026-08-12
**Role:** PRODUCT
**Status:** Ready for DESIGN (visual) + ENGINEERING (implementation)

---

## 0. Product Principles (constraints everything below)

1. **The desk is flat.** Nothing ever covers the workbench except transient CRT output and fault alerts. No modal windows, no drawers stacked over the deck — stacking UI is the "tab chaos" this product exists to kill.
2. **The machine is honest.** Every action has a physical consequence: a sound, a lamp, a gate, a stamped state. No invisible magic. No silent failures.
3. **The operator is in control.** Routing is a deliberate physical act (flip a switch), not an inferred preference.
4. **Fast path wins.** The highest-frequency loop is *tweak prompt → re-run*. Every UI state added to that loop is taxed. If a feature can't survive that test, it's deferred.

---

## 1. The "Tactile vs. Functional" Feature Slice

### 1.1 THE CRUCIAL DECISION: Direct edit on the card. **No card-catalog inspector drawer in the MVP critical path.**

**The call:** Clicking a card opens **inline editing directly on the card body**. The vintage "card-catalog inspector" drawer is **rejected** as the primary interaction.

**Rationale:**
1. **Frequency-weighted UX.** Prompt editing is the dominant action (tweak → re-run loop, 20-40x per session). Every modal open/close costs a context switch (~600-900ms + a tap). A drawer between the user and their text would tax the exact loop this product optimizes.
2. **The desk is flat (Principle 1).** A popup drawer re-introduces stacking — the anti-pattern the workbench exists to remove. A drawer full of cards is a file explorer with extra steps.
3. **Accidental-edit-vs-drag risk is a layout rule, not a UI-state rule.** Editing and dragging never conflict because they use disjoint surfaces: **the text body edits, the punched-edge grip zone drags.** No modal needed to prevent mis-drops.
4. **PWA/touch reality.** On mobile, inline editing on a full-width card is strictly better than editing inside a small drawer. Tap body → card lifts (scale 1.04, hard shadow) → keyboard opens. Same code path as desktop.
5. **Where the drawer survives:** v1.2 "CARD FILE" archive view for *inspection* (status history, past outputs) — explicitly **read-only**, never the edit surface. It is not in the MVP.

**Card anatomy (defines the edit/drag split):**
- Top edge: card number (`PRC-####`) + status chip (`MINTED / PUNCHED / READY / HELD / CORING / DONE / FAULT / VOIDED`)
- Left edge: decorative punch-hole strip — **this strip is the GRIP ZONE** (drag only, cursor changes to a card-gripper)
- Body: prompt text — **edit surface** (click → inline caret, save on 300ms debounce, no save button)
- Bottom edge: `COLS:` character counter (80-col punch-card homage) + token estimate; template cards also carry a `SUGGESTED CORE` stamp
- Right edge: **route stripe** — colored band stamped at FEED time (see §2.2), not at drop time

### 1.2 Minimum Functional Path (one workflow prompt, first run)

| # | Step | Action | System response | Time |
|---|------|--------|-----------------|------|
| 1 | **MINT** | Press `MINT CARD` (or key `M`) | Blank card appears in next free deck slot, auto-focused, cursor blinking | ~0.3s |
| 2 | **PUNCH** | Type prompt directly on the card | Characters render in ink, `COLS:` counter ticks, auto-save 300ms | — |
| 3 | **ROUTE** | Flip a switch on the Switchboard (template cards show a suggested core) | Console lamp + hopper rim LED take the channel color; CRT prints route line | ~0.2s |
| 4 | **GRAB** | Press and hold the grip zone (punched edge) | Card tilts 4°, shadow deepens, cursor → gripper | — |
| 5 | **FEED** | Drag over the Hopper, release | Card arcs into tray → gate opens (if switch engaged) → card slides into feed slot | ~0.6s |
| 6 | **OUTPUT** | — (automatic) | CRT prints the model response character-by-character; card ejects to its original deck slot with `DONE` stamped | API-bound |

**Total deliberate user actions for a first run: 5.** No modal ever opens.

**Edge rule:** dropping a card anywhere that isn't the Hopper returns it silently to its slot — no error, no state change (the machine doesn't scold you for putting a card down).

### 1.3 Card Life Cycle (state machine)

```
MINTED → PUNCHED → READY ⇄ HELD → FEEDING → DONE / FAULT → (eject) → READY
              ↘ VOIDED (long-press / right-click → VOID CARD)
```

| State | Meaning | Editable? | Draggable? | Visual |
|-------|---------|-----------|------------|--------|
| `MINTED` | Blank card on deck | yes (autofocused) | yes | ghost outline, placeholder `PUNCH PROMPT HERE` |
| `PUNCHED` | Text entered, save-pending | yes | no (grip locked while caret active) | blinking caret, card lifted 1.04 |
| `READY` | Saved, on deck | yes | yes | solid ink, chip `READY` |
| `HELD` | In hopper tray (queued or gate closed) | **no** | yes (drag out = EJECT) | splayed in tray, chip `HELD` |
| `FEEDING` | In feed slot, API call in flight | **no** | no | LED pulses, chip `CORING` |
| `DONE` / `FAULT` | Cycle finished, stamped, returning to deck | yes (after eject) | yes | returns to original slot, route stripe visible |

**Lock rule:** a card is only editable when it is physically on the deck. Once it enters the Hopper it is "inside the machine" — pencil can't reach it. Editing resumes automatically on ejection.

### 1.4 Card → Hopper Transition Rules (layout + feedback)

**THE CALL: the card MOVES into the Hopper. It does not stay on the bench.**

1. **Physical truth.** You feed a physical card into a reader; it is no longer on your desk. Maintaining the metaphor builds the correct mental model: *"it's in the machine now."*
2. **Zero ambiguity.** If the card stayed on the bench you'd need a ghost/highlight to distinguish "the card being processed" from all others. Moving it removes the entire class of "which one is running?" confusion.
3. **Tactile progress signal.** The hopper visibly filling and emptying is the status display. An empty hopper = idle. A lit gate = working.

**Transition choreography (what the eye sees):**

| Phase | Trigger | Visual feedback |
|-------|---------|-----------------|
| LIFT | Pointer down on grip zone | Card tilts 4°, hard shadow, gripper cursor, quiet "click" |
| DRAG | Move over the desk | Card follows at 1.0 scale; **hopper rim LED previews the engaged channel color** (or red if none) |
| DROP | Release over hopper tray | Short arc into tray, splay-stack lands with "thunk", chip → `HELD` |
| GATE | Switch engaged + card at top of stack | Gate slides open with "krr-chunk", feed lamp lights |
| FEED | Card enters slot | Card slides down slot (ratchet sound), chip → `CORING`, CRT begins printing |
| EJECT | Response received | Card returns to its original deck slot (or nearest free), chip → `DONE` / `FAULT`, stripe stamped |

**Queue rules:** FIFO by drop order; hopper holds max **6** cards (splay stack, position number printed on each card's top edge). Cards in queue can be re-grabbed and dragged back to the deck = **EJECT** (allowed only while `HELD`, never while `FEEDING`).

### 1.5 Cut from MVP (explicitly deferred)

- Card-catalog inspector drawer (→ v1.2 CARD FILE, read-only archive/audit)
- Reordering cards inside the hopper (v1.1)
- Per-card route pinning (v1.1, see §2.4)
- Shredder bin; voiding = long-press / right-click context action only
- Output export to file (v1.1); queue persistence across reload (v1.1; card drafts persist via IndexedDB from day one)
- Audio library polish, keyboard macros

---

## 2. Multi-AI "Slot Integration" Flow

### 2.1 Switchboard mechanics (the routing console)

**Layout:** Switchboard sits between the Deck and the Hopper. Three industrial toggle switches, one per core:

| Switch | Core alias | Model | Channel color |
|--------|-----------|-------|---------------|
| Switch 1 | `CORE-A` | CLAUDE | amber `#FFB020` |
| Switch 2 | `CORE-B` | GPT-4O | emerald `#3DDC68` |
| Switch 3 | `CORE-C` | GLM-5.2 | cyan `#35C4E8` |

**RULE — single-channel radio with snap-back:** exactly one switch can be engaged. Flipping a second switch while one is engaged causes the first to **spring back with a "clack"**; the new one engages. A machine routes one line at a time; the UI enforces the physical truth. No ambiguous multi-route state exists.

**Exact UI state behavior when switching models:**

| Surface | Before flip | During flip (100ms) | After flip |
|---------|-------------|---------------------|------------|
| Switchboard | old switch down + lit | both switches mid-travel, "clack" | new switch down + lit; old one up + dark |
| Hopper rim LED | old channel color | flickers between colors | new channel color |
| Feed slot lamp | old color | off | new color |
| CRT | idle | prints route line | `ROUTE ENGAGED — CORE-B // GPT-4O // GATE OPEN. AWAITING INPUT.` |
| Cards on deck | unchanged | unchanged | **unchanged** (cards are colorless until fed) |
| Cards `HELD` in hopper | unchanged | unchanged | **unchanged until their feed moment** (§2.2) |

**RULE — routing is sampled at FEED time, not drop time.** A card enters the machine colorless; the moment the gate opens, its route stripe is stamped with the *then-engaged* channel. This makes the switch the single source of truth and eliminates the "stripe says A but machine is running B" contradiction.

**Template suggestion vs. authority:** template cards carry a pre-printed `SUGGESTED CORE` stamp (e.g., `SUGGESTED CORE: CORE-C // GLM-5.2`) — operator guidance only. The switch is authoritative. If a card is fed on a core other than its suggestion, the run proceeds with a warning (below). The machine does not refuse work; it logs the discrepancy.

### 2.2 Feeding a card with NO switch engaged

**Physical behavior:** the hopper's feed gate is **closed** — the card drops into the tray but cannot enter the slot. It is HELD, not rejected. Tray lamp flashes red, a 2×120ms fault buzzer sounds (haptic on mobile), and the CRT prints the fault in bright red on black, monospace, preceded by a bell flash:

```
╔══════════════════════════════════════════════════════════════════╗
║ ERROR 404: NO AI CORING UNIT ENGAGED.                            ║
║ PLEASE FLIP SWITCH TO ROUTE TELEMETRY.                           ║
║ GATE LOCKED — CARD PRC-0007 HELD IN HOPPER.                      ║
╚══════════════════════════════════════════════════════════════════╝
```

**Auto-resume:** the fault prints **once per fault event** (never spammed). The card stays HELD. The moment any switch engages, the gate opens and the held card feeds automatically, with:

```
ROUTE ENGAGED — CORE-A // CLAUDE // GATE OPEN — RESUMING FEED OF PRC-0007.
```

### 2.3 Lockout rules

| Scenario | RULE |
|----------|------|
| **Flip switch mid-execution (card is FEEDING)** | **Allowed mechanically, latched logically.** The switch travels, but the relay stays latched: the in-flight card finishes on the core it started on. CRT: `ROUTE CHANGE DEFERRED — CORE-A CYCLE IN PROGRESS. NEXT CARD ROUTES TO CORE-C.` Rationale: a card physically inside the reader cannot be re-routed; cancelling mid-run is worse than waiting one cycle. |
| **Flip switch while cards are HELD (queued)** | Fully effective. Queued cards inherit the **new** route at their feed moment (routing sampled at feed time, §2.2). The operator's queued card follows the operator's current switch — no surprise executions, no stale routes. |
| **Queued card + model switched after drop** | Card picks up the new route when it feeds; CRT logs the actual route per card at feed time: `FEEDING CARD PRC-0008 → CORE-B. CYCLE START 19:58:32.` Operators who need a card pinned to a specific core must re-engage that core before it feeds (v1.1 adds per-card pinning). |
| **Edit a HELD or FEEDING card** | **Locked.** Cards are only editable on the deck (§1.3). The cursor becomes a "denied" marker over hopper cards. Editing resumes on ejection. |
| **Eject a queued card** | Allowed while `HELD` (drag back to deck). **Never** allowed while `FEEDING`. CRT: `CARD PRC-0004 EJECTED FROM HOPPER. NO DATA LOST.` |
| **Deck capacity** | 8 slots (2×4 grid). Mint beyond that is blocked: `DECK CAPACITY REACHED — 8 CARDS. VOID OR ARCHIVE A CARD BEFORE MINTING.` |
| **Hopper capacity** | 6 cards. A drop onto a full hopper returns the card to the pointer: `HOPPER FULL — 6 CARDS QUEUED. PROCESS OR EJECT BEFORE FEEDING.` |

### 2.4 Canonical CRT copy strings (exact, verbatim)

Monospace, green phosphor (`#33FF66` on `#050805`) by default; fault lines red (`#FF4444`) in the double-border box; all lines end with a blinking block cursor.

| Scenario | Exact CRT copy |
|----------|----------------|
| No switch engaged at drop | `ERROR 404: NO AI CORING UNIT ENGAGED. PLEASE FLIP SWITCH TO ROUTE TELEMETRY.` → `GATE LOCKED — CARD PRC-0007 HELD IN HOPPER.` |
| Route engaged (idle) | `ROUTE ENGAGED — CORE-B // GPT-4O // GATE OPEN. AWAITING INPUT.` |
| Card fed | `FEEDING CARD PRC-0008 → CORE-B. CYCLE START 19:58:32.` |
| Switch flipped mid-run | `ROUTE CHANGE DEFERRED — CORE-A CYCLE IN PROGRESS. NEXT CARD ROUTES TO CORE-C.` |
| Suggested-core mismatch | `WARNING 117 — SUGGESTED CORE-C, ENGAGED CORE-B. FEEDING AS ENGAGED.` |
| Cycle complete | `CYCLE COMPLETE — CARD PRC-0008 // CORE-B // OUTPUT: 1,847 TOKENS. EJECTED TO BENCH.` |
| Manual eject | `CARD PRC-0004 EJECTED FROM HOPPER. NO DATA LOST.` |
| Hopper full | `HOPPER FULL — 6 CARDS QUEUED. PROCESS OR EJECT BEFORE FEEDING.` |
| Deck full | `DECK CAPACITY REACHED — 8 CARDS. VOID OR ARCHIVE A CARD BEFORE MINTING.` |
| Provider fault | `FAULT 502 — CORE-B NO RESPONSE. CARD PRC-0006 MARKED FAULT. RETRY IN 30S.` |
| Auto-resume after fault | `ROUTE ENGAGED — CORE-A // CLAUDE // GATE OPEN — RESUMING FEED OF PRC-0007.` |

**Tone rules:** imperative, machine-voice, zero apologetics, zero jargon beyond the machine vocabulary (CORE, FEED, GATE, EJECT, TELEMETRY, CORING). Errors state the cause and the operator's exact remedy in one breath.

---

## 3. Default "Workbench Utility" Cards

Three pre-punched cards sit on the deck on day one, in slots 1-3, each carrying its `SUGGESTED CORE` stamp. All are fully editable — the operator can punch over them. Voids can be restored via a TEMPLATE FILE rack (v1.1).

### Card 1 — `REACT COMPONENT SCAFFOLD`
**SUGGESTED CORE: CORE-A // CLAUDE**

```
┌──────────────────────────────────────────────────────────────────┐
│ CARD: REACT COMPONENT SCAFFOLD          PRC-TPL-001   SUGGESTED  │
│ CORE: CORE-A // CLAUDE                    ┌────────────────────┐ │
│ Component name: ________________________ │ CLAUDE ● CORE-A    │ │
│ One-line purpose: ______________________ │                    │ │
│ Language: TypeScript / JavaScript (default TS)                 │ │
│ Style system: Tailwind / CSS Modules / Plain CSS / styled-*    │ │
│ Props contract (TS): ___________________________________________│ │
│ State + effects required: ______________________________________│ │
│ Accessibility: keyboard nav / ARIA / focus trap (default: all)  │ │
│ Edge cases to handle: __________________________________________│ │
│                                                                  │ │
│ OUTPUT CONTRACT — return exactly four sections, nothing else:    │ │
│ 1. IMPORTS — complete, exact module paths                        │ │
│ 2. SOURCE — full runnable typed component, no truncation, no "…" │ │
│ 3. USAGE — one example, 5 lines max                              │ │
│ 4. NOTES — 3-6 bullets: assumptions made, prop table, test names │ │
└──────────────────────────────────────────────────────────────────┘
```

**Routing rationale (one line):** Claude's structured-reasoning strength holds a multi-section output contract and edge-case list without drift — ideal for consistent, production-shaped component generation.

### Card 2 — `LONG-CONTEXT DOCUMENT PROCESSOR`
**SUGGESTED CORE: CORE-C // GLM-5.2**

```
┌──────────────────────────────────────────────────────────────────┐
│ CARD: LONG-CONTEXT DOCUMENT PROCESSOR   PRC-TPL-002   SUGGESTED  │
│ CORE: CORE-C // GLM-5.2                    ┌───────────────────┐ │
│                                                                  │ │
│ DOCUMENT SOURCE — paste or drop text below (full pass, NO        │ │
│ chunking; GLM-5.2 window handles the entire input):              │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│                                                                  │ │
│ Task type: Summarize / Extract / Reorganize / Audit  (pick one)  │ │
│ Output structure: ______________________________                 │ │
│ Granularity: per-paragraph / per-section / global                │ │
│ Precision: numbers must be exact; preserve units and timestamps  │ │
│                                                                  │ │
│ OUTPUT CONTRACT:                                                 │ │
│ 1. STATUS LINE — "Processed: N chars / M sections"               │ │
│ 2. STRUCTURED OUTPUT per task type and chosen structure          │ │
│ 3. UNCERTAINTY LIST — anything ambiguous or possibly hallucinated│ │
│ 4. No preamble, no commentary outside the contract               │ │
└──────────────────────────────────────────────────────────────────┘
```

**Routing rationale (one line):** GLM-5.2's long-context window is the entire point — the card forbids chunking and trusts the full pass, which only this core can deliver for massive docs/logs.

### Card 3 — `TEST CASE WRITER`
**SUGGESTED CORE: CORE-B // GPT-4O**

```
┌──────────────────────────────────────────────────────────────────┐
│ CARD: TEST CASE WRITER               PRC-TPL-003   SUGGESTED     │
│ CORE: CORE-B // GPT-4O                    ┌────────────────────┐ │
│ Component/function under test: ____________ │ GPT-4O ● CORE-B │ │
│ Input domain: ____________________________                    │ │
│ Expected behaviors (bullets): ____________                    │ │
│ Known edge cases: ________________________                    │ │
│ Framework: Jest / Vitest / Playwright / raw-Gherkin (default) │ │
│ Volume target: 15-30 raw cases                                 │ │
│                                                                  │ │
│ OUTPUT CONTRACT:                                                 │ │
│ 1. COVERAGE MATRIX — table: case ID | input | expected | priority│ │
│ 2. RAW CASES — one GIVEN / WHEN / THEN block per case, no prose  │ │
│ 3. GAPS — behaviors the spec didn't cover, listed separately     │ │
└──────────────────────────────────────────────────────────────────┘
```

**Routing rationale (one line):** GPT-4o's speed and breadth make it the workhorse for high-volume raw enumeration — exactly what raw test-case generation needs, with the coverage matrix catching its occasional sloppiness.

---

## 4. MVP Definition of Done (acceptance checklist)

- [ ] 5-action path to first output: MINT → PUNCH → ROUTE → FEED → OUTPUT, no modal in the path
- [ ] Direct inline card editing; drag only from grip zone; edit only on deck
- [ ] Card physically moves into Hopper; original deck slot remembered and restored on eject
- [ ] Single-channel switchboard with snap-back radio behavior; routing sampled at feed time
- [ ] Exact fault copy `ERROR 404: NO AI CORING UNIT ENGAGED…` + gate-lock physical behavior + auto-resume
- [ ] All 11 CRT copy strings verbatim per §2.4
- [ ] Lockout rules enforced: no edit while HELD/FEEDING, no eject while FEEDING, deferred route change mid-run, caps at 8 deck / 6 hopper
- [ ] Three template cards on deck day one with exact titles, suggested-core stamps, and output contracts
