# RETRO AI WORKBENCH — Design System & Component Spec (ART → Dave)

> **Status:** Ready for implementation. Every value below is final; translate 1:1 into Tailwind config + React components. No interpretation required.
> **Stack target:** React 18 + Vite + TypeScript, Tailwind CSS, Lucide React.
> **Hard constraints from product:** Netlify static + Functions; PocketBase only (no Supabase). PWA installable.

---

## 0. Design Intent (read once, then build)

| Question | Answer |
|---|---|
| **Purpose** | A single-screen "machine" that routes one prompt to one of three AI models (Claude, GPT-4o, GLM-5.2) via physical-metaphor controls, and streams the reply on a CRT. |
| **Tone** | 1980s brutalist analog hardware. Beige plastic, dark brushed metal, faux wood, glowing CRT green. Every element must look like it could be unscrewed with a screwdriver. |
| **Constraints** | Keyboard accessible, WCAG 2.2 AA contrast, no emoji (Lucide icons only), glow reserved exclusively for display surfaces (CRT, LEDs) — never on chrome. |
| **Differentiation** | The three physical toggle switches + the Hopper drop + typewriter-streamed CRT. The memory point is the *switch click*: flipping hardware to choose a model. |

**Metaphor lock-in (do not mix):** Punch Card = prompt input · Switchboard = model selection (radio, exactly one ON) · Hopper = execution drop-zone · CRT = output. No other metaphors allowed in the UI (no chat bubbles, no "send" paper planes, no toasts).

---

## 1. Color & Style Palette — "Brutalist Hardware"

### 1.1 Full token table

All colors are purpose-named (never hue-named). No pure black/white anywhere — the eye-strain rule applies.

| Token | Tailwind key | Hex | Role |
|---|---|---|---|
| `chassis` | `chassis` | `#D8D3C4` | Main body: beige plastic (page background, panels) |
| `chassis-light` | `chassisLight` | `#E8E4D8` | Raised plastic faces (top bevels, card wells, key caps) |
| `chassis-dark` | `chassisDark` | `#B9B3A2` | Plastic shadow faces, recessed grooves |
| `metal` | `metal` | `#2A2D32` | Brushed industrial gray (switchboard plate, bezels) |
| `metal-light` | `metalLight` | `#3A3E45` | Brushed highlights, screws, LED housings |
| `metal-dark` | `metalDark` | `#1E2124` | Metal recesses, plate wells |
| `metal-text` | `metalText` | `#9A9FA6` | Engraved labels on dark metal (secondary) |
| `wood` | `wood` | `#4A2E1B` | Faux-wood side panels / end caps |
| `wood-dark` | `woodDark` | `#382214` | Wood grain shadow tone |
| `wood-light` | `woodLight` | `#5C3A24` | Wood grain highlight tone |
| `paper` | `paper` | `#EDE7D8` | Punch card stock (NOT white) |
| `paper-dark` | `paperDark` | `#E1DAC6` | Card edge shading, un-punched hole wells |
| `ink` | `ink` | `#241D15` | Typewriter ink / text on light surfaces (11.6:1 on chassis) |
| `ink-soft` | `inkSoft` | `#5A554A` | Secondary text on light surfaces (4.85:1) |
| `crt-black` | `crtBlack` | `#0A0E08` | Cathode-ray display background (NOT `#000`) |
| `crt-black-2` | `crtBlack2` | `#10170C` | Screen well inner glow base |
| `phosphor` | `phosphor` | `#39FF14` | CRT green text + active LED (≈16:1 on crtBlack) |
| `phosphor-dim` | `phosphorDim` | `rgba(57,255,20,0.55)` | Faded CRT text, idle LED glow |
| `amber` | `amber` | `#FFB000` | Warning / Hopper "READY TO FEED" / dark-surface focus ring |
| `led-red` | `ledRed` | `#FF3B30` | Power LED, error states |
| `led-off` | `ledOff` | `#3A3E45` | Dead LED lens |
| `focus-dark` | — | `#2A2D32` | Focus ring on **light** surfaces (amber fails 3:1 on beige) |
| `focus-light` | — | `#FFB000` | Focus ring on **dark** surfaces (7.2:1 on metal) |

### 1.2 CSS custom properties (source of truth)

```css
:root {
  --chassis:        #D8D3C4;
  --chassis-light:  #E8E4D8;
  --chassis-dark:   #B9B3A2;
  --metal:          #2A2D32;
  --metal-light:    #3A3E45;
  --metal-dark:     #1E2124;
  --metal-text:     #9A9FA6;
  --wood:           #4A2E1B;
  --wood-dark:      #382214;
  --wood-light:     #5C3A24;
  --paper:          #EDE7D8;
  --paper-dark:     #E1DAC6;
  --ink:            #241D15;
  --ink-soft:       #5A554A;
  --crt-black:      #0A0E08;
  --crt-black-2:    #10170C;
  --phosphor:       #39FF14;
  --phosphor-dim:   rgba(57, 255, 20, 0.55);
  --amber:          #FFB000;
  --led-red:        #FF3B30;
  --led-off:        #3A3E45;

  --font-crt:  'VT323', 'IBM Plex Mono', ui-monospace, 'Courier New', monospace;
  --font-mono: 'IBM Plex Mono', 'Courier New', ui-monospace, monospace;

  --radius-panel: 8px;
  --radius-key:   3px;
  --radius-bezel: 20px;

  --ease-tactile: cubic-bezier(0.2, 0.9, 0.3, 1);   /* presses: 80–120ms, no overshoot */
  --ease-mech:    cubic-bezier(0.34, 1.3, 0.5, 1);   /* toggles: 150ms, slight snap */
}
```

> **font choice audit trace:** VT323 (CRT display) + IBM Plex Mono (typewriter/UI) — mono-only pairing is intentional (terminal hardware fiction). This deliberately avoids the Inter/Roboto/Space Grotesk AI-defaults.

### 1.3 Tactile shadows (the core of the "heavy" feel)

Every surface is either **raised** (outset shadows + inner bevel) or **sunken** (inset shadows). Never both on the same element. Values are exact; use the Tailwind keys.

```css
/* RAISED — panels, buttons, key caps, toggle housings */
.raised-sm {  /* small raised items: toggle lever, key cap */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.5),          /* top bevel catch-light */
    inset 0 -1px 0 rgba(0,0,0,0.2),               /* bottom inner shade  */
    1.5px 1.5px 0 rgba(20,16,10,0.35),            /* hard offset = brutalist */
    2px 2px 6px rgba(20,16,10,0.2);               /* soft ambient        */
}
.raised-md {  /* buttons, switch plates, LED housings */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.5),
    inset 0 -2px 0 rgba(0,0,0,0.25),
    2px 2px 0 rgba(20,16,10,0.35),
    4px 4px 10px rgba(20,16,10,0.22);
}
.raised-lg {  /* zone frames, bezel, chassis header */
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,0.5),
    inset 0 -3px 0 rgba(0,0,0,0.3),
    3px 3px 0 rgba(20,16,10,0.32),
    8px 8px 22px rgba(20,16,10,0.24);
}

/* SUNKEN — hoppers, wells, CRT screen, engraved plates */
.sunk {  /* recessed slot: Hopper interior, switchboard plate interior */
  box-shadow:
    inset 0 3px 8px rgba(0,0,0,0.55),
    inset 2px 2px 6px rgba(0,0,0,0.35),
    inset 0 -1px 0 rgba(255,255,255,0.16),
    0 1px 0 rgba(255,255,255,0.4);               /* outer bottom edge highlight */
}
.sunk-deep {  /* CRT screen well — deepest recess on the machine */
  box-shadow:
    inset 0 4px 16px rgba(0,0,0,0.75),
    inset 3px 3px 10px rgba(0,0,0,0.5),
    inset 0 -1px 0 rgba(255,255,255,0.12);
}

/* PRESSED — active button, engaged key (replaces raised-md while active) */
.pressed {
  box-shadow:
    inset 0 2px 4px rgba(0,0,0,0.35),
    inset 0 -1px 0 rgba(255,255,255,0.15),
    0 1px 0 rgba(20,16,10,0.3);
  transform: translateY(2px);
}

/* GLOWS — display surfaces ONLY (CRT text, engaged LEDs, hopper alert) */
.glow-phosphor {  /* engaged LED */
  box-shadow:
    0 0 6px  rgba(57,255,20,0.9),
    0 0 16px rgba(57,255,20,0.55),
    0 0 32px rgba(57,255,20,0.25);
}
.glow-crt {  /* phosphor text */
  text-shadow:
    0 0 6px rgba(57,255,20,0.7),
    0 0 2px rgba(57,255,20,0.9);
}
.glow-amber {  /* Hopper drag-over outline + inner light */
  box-shadow:
    inset 0 0 0 3px rgba(255,176,0,0.9),
    inset 0 0 28px rgba(255,176,0,0.35),
    inset 0 3px 8px rgba(0,0,0,0.4);
}
.glow-red {  /* power LED */
  box-shadow:
    0 0 6px  rgba(255,59,48,0.9),
    0 0 14px rgba(255,59,48,0.5);
}
```

**Rule of thumb:** 1 hard offset shadow (2–3px, no blur) + 1 bevel inset + 1 soft ambient. If it doesn't look like it has *weight*, it isn't done.

---

## 2. Typography

| Role | Font | Size / Line-height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| CRT stream text | `--font-crt` | 22px / 1.35 | 400 | `0` | Terminal output (VT323 authentic) |
| CRT meta line | `--font-crt` | 18px / 1.3 | 400 | `0` | prompt echo, status line |
| Zone titles (caps) | `--font-mono` | 12px / 1.4 | 600 | `0.08em` | "SWITCHBOARD", "HOPPER"… ALL CAPS |
| Model labels | `--font-mono` | 13px / 1.4 | 600 | `0.08em` | CLAUDE / GPT-4o / GLM-5.2 |
| Typewriter card title | `--font-mono` | 13px / 1.5 | 500 | `0` | Punch card header line |
| Body / UI text | `--font-mono` | 14px / 1.6 | 400 | `0` | instructions, meta |
| Micro labels | `--font-mono` | 11px / 1.5 | 400 | `0.02em` | LED captions, screws, legends |

Craft rules in force: ALL CAPS **always** carries `0.06em–0.1em` tracking; body tracking is `0`; never justify body text; max 2 typefaces (VT323 + IBM Plex Mono); body copy max-width `65ch`.

---

## 3. Zone A — 3-Model Switchboard Panel

### 3.1 Composition

```
┌──────────────────────────────────────────────────────┐
│ SWITCHBOARD · MODEL ROUTER              ║ POWER ●    │  ← metal plate header (raised-lg)
├──────────────────────────────────────────────────────┤
│  ┌────────┐   ┌────────┐   ┌────────┐                 │
│  │  [LED] │   │  [LED] │   │  [LED] │                 │  ← LED lens per switch
│  │   ●    │   │   ●    │   │   ●    │                 │
│  │ [LEVER]│   │ [LEVER]│   │ [LEVER]│                 │  ← bat-style lever
│  │  |     │   │  |     │   │  |     │                 │
│  │ CLAUDE │   │ GPT-4o │   │ GLM-5.2│                 │  ← engraved model plate
│  └────────┘   └────────┘   └────────┘                 │
└──────────────────────────────────────────────────────┘
```

### 3.2 Spec

- **Panel:** `bg-metal text-metalText`, `rounded-[8px]`, `shadow-raised-lg`, inner plate well is `sunk` (`bg-metal-dark` inset area behind the switches).
- **Per-switch unit:** width `120px`, height `150px`, `rounded-[6px]`, `bg-metal-light`, `shadow-raised-md`. One unit per model.
- **Lever:** a `<button role="radio" aria-checked="false|true">` — **up = OFF, down = ENGAGED** (classic bat switch).
  - Lever body: `w-[44px] h-[14px] rounded-[4px] bg-[#8B8E93] shadow-raised-sm`, positioned centered, `transform-origin: center`.
  - ENGAGED: `transform: rotate(180deg)` — flips the lever down. Transition `transform 150ms var(--ease-mech)`.
  - Add a subtle engraved arrow next to the lever (`↓ ON / ↑ OFF`) for non-color affordance.
- **LED indicator:** `w-[10px] h-[10px] rounded-full` above each lever, `aria-hidden="true"`.
  - OFF: `bg-led-off` + faint `inset` shade (`box-shadow: inset 0 1px 2px rgba(0,0,0,0.6)`), **no glow**.
  - ENGAGED: `bg-phosphor` + `glow-phosphor`. LED state is *decorative*; the source of truth is `aria-checked`.
- **Model label:** engraved plate `bg-metal-dark text-metalText` (OFF) → `text-phosphor` (ENGAGED), `text-[13px] font-semibold tracking-[0.08em]`. Label text: `CLAUDE`, `GPT-4o`, `GLM-5.2` (keep model casing as-is; only `CLAUDE` is fully uppercase).
- **Radio behavior:** all three levers share one state — exactly one ENGAGED. Clicking a lever engages it and disengages the others (`role="radiogroup"` on the container, `aria-checked` per lever).

### 3.3 States

| State | Lever | LED | Label | Extra |
|---|---|---|---|---|
| OFF (default) | up, `bg-[#8B8E93]`, `raised-sm` | `led-off`, no glow | `metal-text` | — |
| Hover | up, `translateY(-1px)` | — | — | cursor: pointer |
| ENGAGED | down (`rotate(180deg)`), lever turns `bg-metal-light` w/ top highlight | `phosphor` + glow | `text-phosphor` | panel border `1px solid rgba(57,255,20,0.35)` |
| ENGAGED + hover | down, slight `translateY(1px)` push | glow | `text-phosphor` | — |
| Disabled (model offline) | up, `opacity-40`, cursor-not-allowed | off | dimmed | `aria-disabled="true"`, tooltip "MODEL OFFLINE" |
| Focus-visible (keyboard) | — | — | — | `outline: 2px solid var(--amber); outline-offset: 3px` (amber on dark metal = 7.2:1) |

---

## 4. Zone B — Digital Punch Card Bench

### 4.1 Composition

IBM 80-column card, aspect ≈ 2.27:1. On screen: `w-[320px] h-[141px]` (matches ratio). Optional enlarge to `w-[400px] h-[176px]` on ≥1280px screens.

```
┌───────────────────────────────────────────────╮
│ RETRO AI WORKBENCH  ·  CARD #0042      ╭─ CUT │   ← notched corner
│ MODEL:GPT-4o  PROMPT:"..."             ╯      │
│ ▓ ▓ ▓  ▓ ▓  ▓ ▓ ▓  ▓  ▓  ▓ ▓  ▓ ▓  ▓ ▓ ▓ ...  │   ← punched-hole grid (top 12 rows)
│                                               │
│   (live prompt text, typewriter mono, ink)     │
│                                               │
│ ▓ ▓  ▓ ▓  ▓ ▓  ▓ ▓  ▓  ▓  ▓ ▓  ▓  ▓  ▓ ▓ ...  │   ← punched-hole grid (bottom zone)
└───────────────────────────────────────────────┘
```

### 4.2 Spec

- **Card body:** `bg-paper`, `shadow-raised-md`, `rounded-[2px]` (card stock is almost square-edged).
- **Notched top-right corner:** `clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)`. Add a 1px darker diagonal edge line (`paperDark`) along the cut via a rotated pseudo-element or SVG — the cut must read as *card stock*, not a CSS accident.
- **Paper texture** (subtle, non-repeating noise — do not use a stock photo):
  ```css
  background-image:
    radial-gradient(ellipse at 12% 8%, rgba(120,105,80,0.06) 0%, transparent 55%),
    radial-gradient(ellipse at 88% 92%, rgba(120,105,80,0.05) 0%, transparent 50%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  ```
- **Typewriter title line:** `--font-mono`, `text-[13px] font-medium text-ink`, no tracking. Format: `RETRO AI WORKBENCH · CARD #0042`. Below it a second line: `MODEL:GPT-4o PROMPT:"…"` (updates live). Optionally a red stamp `ORIGINAL` in `led-red` at 0.8 opacity, rotated `-2deg`, for texture.
- **Punched-hole grid:** two bands (top + bottom), each = **80 columns × 12 rows** of tiny holes (IBM punch zones).
  - Hole: `w-[3px] h-[5px] rounded-[1px]`, resting color `rgba(36,29,21,0.45)` (un-punched).
  - "Punched" holes (the card's actual data — map from the prompt): full `#241D15` + `box-shadow: inset 0 1px 2px rgba(0,0,0,0.6)` so they read as holes letting shadow through.
  - Render with a CSS grid (`grid-template-columns: repeat(80, 3px); gap: 1px`) generated in a loop — **do not hand-write 960 divs**; a `useMemo` array is fine. `aria-hidden="true"` on the grid.
  - Grid columns: 80 (authentic). If 80 columns looks too dense at 320px, use `repeat(40, …)` — but only if the real 80-col render visually breaks.

### 4.3 States

| State | Behavior |
|---|---|
| Default | Full card, title + prompt line + hole grid |
| Editing prompt | Title line stays; prompt line streams the current keystrokes (typewriter) |
| Card "drafted" (prompt ready) | Slight lift: `translateY(-1px)`; corner cut catches a soft highlight |
| Disabled (no prompt) | Card sits flat at 85% opacity, holes all un-punched, title shows `CARD #—` |

---

## 5. Zone C — Mechanical Hopper Slot

### 5.1 Composition

Recessed metal slot under the Switchboard: **the drop-zone for the punch card = the "execute" action.** Width `100%` of its container, height `110px`.

### 5.2 Spec

- **Outer bezel:** `rounded-[8px]`, `bg-metal`, `shadow-raised-md`, `p-[10px]`.
- **Slot well (the actual drop target):** `bg-metal-dark`, `sunk` shadow, `rounded-[6px]`, `border: 1px solid rgba(0,0,0,0.4)`.
- **Interior:** centered vertical stack:
  - Lucide icon: `ArrowDownToLine` (or `Tray`) at `w-6 h-6`, `text-metalText`, `stroke-width: 1.75`.
  - Label: `FEED PUNCH CARD` — `--font-mono`, `text-[12px] font-semibold tracking-[0.08em]`, `text-metalText`.
  - Sub-label: `DROP TO EXECUTE` — `text-[11px] tracking-[0.02em]`, `text-metalText/70`.
- **The drop-zone element itself:** use a real `<input type="file">`-free approach — the Hopper accepts the punch card *component* (drag of the card within the app). Dave: implement with HTML5 DnD; prevent default on `dragover` at **document level** (needed for drop to fire) and use a **drag counter** (enter/leave pairs) so children don't flicker the state.

### 5.3 States — exact highlight contract

| State | Class / style | Exact values |
|---|---|---|
| Idle | slot well | `sunk` + `bg-metal-dark` |
| Drag-over | `glow-amber` | `box-shadow: inset 0 0 0 3px rgba(255,176,0,0.9), inset 0 0 28px rgba(255,176,0,0.35), inset 0 3px 8px rgba(0,0,0,0.4)`; background brightens to `#1B1E12` |
| Drag-over text | — | Label flips to `READY TO FEED` in `text-amber` with amber text-shadow: `text-shadow: 0 0 6px rgba(255,176,0,0.7)` |
| Drag-over pulse | animation | `pulse-amber` 750ms infinite (1.33 Hz — under the 3-flash/sec WCAG cap): `@keyframes pulse-amber { 0%,100% { opacity: 1 } 50% { opacity: 0.75 } }` |
| Drop accepted | — | Instant: amber outline collapses → well flashes `bg-crt-black-2` + phosphor ring `glow-phosphor` 300ms → executes. Fire `clack-chunk.wav` here. |
| Drop rejected (wrong payload) | — | Ring flashes `led-red` (no pulse), 300ms, label `REJECTED`; `aria-live="polite"` announces "Card rejected". |
| Focus-visible | — | `outline: 2px solid var(--amber); outline-offset: 3px` |

**Why amber, not green:** amber is the machine's "attention" color (warnings, hopper states); phosphor green is reserved for *active output* (CRT + engaged LEDs). Never use both for the same kind of signal.

---

## 6. Zone D — Curved CRT Terminal

### 6.1 Composition

```
┌───────────────────────────────────────┐  ← bezel: metal, radius 20px, raised-lg
│  ╭─────────────────────────────────╮  │
│  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  │  ← screen: crt-black, sunk-deep
│  │ ▒  > ROUTING PROMPT TO GPT-4o  ▒ │  │
│  │ ▒  CLICK. THE MACHINE IS LIVE. ▒ │  │  ← phosphor text + glow-crt
│  │ ▒  STREAMING…                   ▒ │  │
│  │ ▒                               ▒ │  │
│  │ ▒  █                           ▒ │  │  ← blinking block cursor
│  ╰─────────────────────────────────╯  │
└───────────────────────────────────────┘
```

### 6.2 Spec

- **Bezel:** `bg-metal`, `rounded-[20px]`, `shadow-raised-lg`, padding `24px`. Optional: two faux screws (`w-2 h-2 rounded-full bg-metal-dark` with a 1px slot line) in the bottom corners.
- **Screen:** `aspect-[4/3]` (min-height `260px`), `bg-crt-black`, `sunk-deep`, `rounded-[12px]`, `overflow-hidden`, `relative`. Add faint curvature illusion: `background: radial-gradient(ellipse 120% 100% at 50% 0%, var(--crt-black-2) 0%, var(--crt-black) 60%)`.
- **Glass highlight layer** (`pointer-events-none`, `absolute inset-0`): a 1px `rgba(255,255,255,0.05)` top edge + a curved sheen at top-left:
  ```css
  background:
    linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 30%),
    radial-gradient(ellipse 90% 70% at 50% 110%, rgba(0,0,0,0.5), transparent 60%);
  ```
- **Scanline overlay** (`pointer-events-none`, `absolute inset-0`, above all content):
  ```css
  background:
    repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0 1px, transparent 1px 4px);
  ```
  (Vertical band adds the aperture-grille look; if it moirés on the user's display, keep only the horizontal scanlines.)
- **Phosphor leak** (screen glow bleeding onto the bezel): on the screen wrapper, `box-shadow: 0 0 40px rgba(57,255,20,0.12)` — faint, not a neon sign.
- **Output text:** `--font-crt` (VT323), `text-[22px] leading-[1.35]`, `text-phosphor`, `glow-crt`, `whitespace-pre-wrap`, `word-break: break-word`, `-webkit-font-smoothing: none` for the authentic blocky pixel look.
- **Blinking block cursor:** a `<span aria-hidden="true">` rendered as an inline-block:
  ```css
  .crt-cursor {
    display: inline-block;
    width: 0.6em;
    height: 1.1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: var(--phosphor);
    box-shadow: 0 0 6px rgba(57,255,20,0.8);
    animation: crt-blink 1s steps(2, jump-none) infinite;
  }
  @keyframes crt-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
  ```
  (`steps()` gives the hard on/off CRT blink, not a smooth fade. 1 Hz — safe.)
- **Streaming:** append tokens to the stream node; cursor stays at the stream end. Scroll: the screen is `overflow-y: auto` with a **styled** scrollbar (`scrollbar-width: thin; scrollbar-color: var(--phosphor-dim) var(--crt-black)`), and auto-scrolls to bottom only if the user is already near the bottom (don't yank their scroll).
- **Power-on animation** (one-shot, on terminal mount):
  ```css
  @keyframes crt-on {
    0%   { opacity: 0;   filter: brightness(6) blur(2px); }
    12%  { opacity: 1;   filter: brightness(4); }
    25%  { opacity: 0.85; }
    40%  { opacity: 1; }
    55%  { opacity: 0.92; }
    100% { opacity: 1;   filter: brightness(1) blur(0); }
  }
  /* applied to the screen layer, 400ms, forwards */
  ```
  Plus a brief horizontal roll line: a 2px `phosphor-dim` bar sweeping top→bottom once (`top: -10% → 110%`, 350ms) during power-on. This is a single burst (≤3 flashes) — WCAG-safe.

### 6.3 States

| State | Behavior |
|---|---|
| Idle | Black screen, dim `> ` prompt, static cursor |
| Power-on | `crt-on` flash + roll line + `crt-hum.wav` fade-in |
| Streaming | Text types in, cursor at end, hum continues |
| Stream complete | Cursor stops blinking → becomes solid block; hum fades out (400ms) |
| Error | Stream shows `ERROR 0x0F — MODEL UNREACHABLE` in `led-red` text (`#FF6B61` brightened for contrast on crt-black ≈ 7:1) + red text-shadow |
| Empty | `> AWAITING PUNCH CARD…` in `phosphor-dim` |

---

## 7. Micro-Interaction & Motion Spec

### 7.1 Tactile feedback — exact deltas

| Interaction | Element | From → To | Duration / easing |
|---|---|---|---|
| Button press (RUN, key caps) | `.btn-hard` | `raised-md` + `translateY(0)` → `.pressed` + `translateY(2px)` | 80ms / `ease-tactile` (release: 120ms) |
| Toggle flip (Zone A lever) | lever | `rotate(0)` → `rotate(180deg)` | 150ms / `ease-mech` |
| LED engage | LED lens | off (no glow) → `glow-phosphor` | 80ms fade-in, no delay |
| Drag elevation (card in flight) | punch card | `raised-md`, `translateY(0)` → `raised-lg`-style, `translateY(-4px) rotate(-1.5deg)`, `box-shadow: 3px 3px 0 rgba(20,16,10,0.32), 12px 14px 30px rgba(20,16,10,0.3)` | 120ms / `ease-tactile` |
| Drag hover (card over hopper) | hopper well | idle `sunk` → `glow-amber` + `READY TO FEED` | 90ms, no animation — instant snap |
| Drop execute | hopper well | amber → phosphor ring flash 300ms → run | 300ms / linear |
| Hover (raised elements only) | buttons, levers, card | `translateY(-1px)` + ambient shadow grows 25% | 120ms / `ease-tactile` |
| Focus-visible | any interactive | `outline: 2px solid amber (dark surfaces) / metal (light surfaces); outline-offset: 3px` | instant |

**Discipline rules:** hover transforms only on `@media (hover: hover) and (pointer: fine)` (touch devices must not show hover lift). Motion budget = 1 element animating per event, max. No parallax, no scroll-triggered reveals, no bounce easings (`cubic-bezier(0.68,-0.55,0.265,1.55)` is banned).

### 7.2 `prefers-reduced-motion` handling

When `prefers-reduced-motion: reduce`:
- Cursor: solid block, no blink.
- Power-on: single 60ms flash only (or skip entirely — skip is fine).
- Hopper pulse: solid outline, no pulse animation.
- Drag elevation: no rotate, `translateY(-2px)` only.
- All transitions collapse to 0ms except the 80ms press (haptic feedback is essential).

---

## 8. Audio Trigger Spec

### 8.1 Files (local, bundled as static assets — Netlify serves them fine)

| File | Duration (target) | Loop? | Character |
|---|---|---|---|
| `click.wav` | 40–80 ms | no | sharp mechanical toggle/relay click, 2–4 kHz transient |
| `clack-chunk.wav` | 120–200 ms | no | heavy card-drop: low thump (80–200 Hz) + plastic clack |
| `crt-hum.wav` | 2–4 s | **yes — seamless loop, no click at seam** | 100 Hz hum + faint 60 Hz mains buzz + soft hiss |

### 8.2 Trigger map (exact hooks for Dave)

| Event | File | Where in code |
|---|---|---|
| Model switch engaged (Zone A) | `click.wav` | `onSelect(model)` — fire **only on the newly engaged switch**, not on disengaged ones |
| Card dropped + accepted (Zone C) | `clack-chunk.wav` | Hopper `onDrop` → after validation passes, before execution starts |
| Drop rejected | none (or `click.wav` pitched down — optional) | Hopper `onDrop` → validation fail branch |
| Terminal power-on (app mount / Zone D mount) | `crt-hum.wav` (loop, fade in) | `useEffect` on terminal mount |
| Streaming starts (first token) | `crt-hum.wav` (ensure playing) | on `onStreamStart` callback |
| Streaming ends / idle | — (fade hum out 400ms) | on `onStreamComplete` / `onStreamError` |
| Card pick-up (dragstart) | optional `click.wav` | Zone B `onDragStart` (default: off; behind a "SOUND: ON/OFF" toggle) |

### 8.3 Implementation contract (Dave)

```ts
// src/lib/fx.ts — single audio module, no per-component <audio> tags
export const fx = {
  click(): void,
  clack(): void,
  humStart(): void,   // loop crt-hum, ramp volume to 0.35 over 400ms
  humStop(): void,    // ramp to 0 over 400ms, then pause
  setMuted(m: boolean): void,
  get muted(): boolean,
};
```

- Use **Web Audio API** (fetch + `decodeAudioData` + `AudioBufferSourceNode`) with one shared `AudioContext`. `crt-hum` = a looping `AudioBufferSourceNode` with a `GainNode` you ramp.
- **Autoplay policy:** create/resume the `AudioContext` on the first user gesture (`pointerdown`/`keydown` listener, one-time). Before that, all calls no-op silently.
- Hum fade target: `0.35` gain; click/clack: `0.9`.
- No audio overlap spam: `click()` retriggers may cut off the previous instance (fine); `clack()` never fires more than once per drop.
- A `SOUND: ON/OFF` toggle in the chassis header (Lucide `Volume2`/`VolumeX`), persisted to `localStorage`, defaults ON.

---

## 9. Accessibility & Safety Checklist (Dave must run this)

- [ ] Contrast gates: body text on surfaces ≥ 4.5:1; UI components ≥ 3:1 (verified pairs in §1.1: phosphor/crt ≈ 16:1, ink/chassis ≈ 11.6:1, amber/metal ≈ 7.2:1, amber/chassis = **1.2:1 → never use amber text on beige**, use `focus-dark` there).
- [ ] Switchboard = `radiogroup` + `role="radio"` + `aria-checked`; state never conveyed by color alone (lever position + label color + text).
- [ ] All interactive elements reachable + operable via keyboard; activation on Enter/Space; visible focus ring everywhere (no `outline: none` without replacement).
- [ ] Hopper drop has a keyboard equivalent: "INSERT CARD" button (keyboard users can't drag). `Fitts: hit target ≥ 44px`.
- [ ] Flashing audit: cursor 1 Hz, hopper pulse 1.33 Hz, power-on single burst ≤ 3 flashes — all under WCAG 2.3.1.
- [ ] `prefers-reduced-motion` rules from §7.2 applied.
- [ ] Alt text on all imagery; punched-hole grid + scanlines + LEDs are `aria-hidden` (decorative).
- [ ] `<html lang="en">`; landmark elements (`header/main/aside`); heading hierarchy without skips.
- [ ] Emoji ban: Lucide icons only, `stroke-width` 1.75, `currentColor`.
- [ ] Streaming text keeps `aria-live` off during high-frequency token appends (screen readers get the **final** text on stream end — announce via `aria-live="polite"` on the container, throttled to stream end, not per token).

---

## 10. Copy-Paste Tailwind Config

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chassis:      '#D8D3C4',
        chassisLight: '#E8E4D8',
        chassisDark:  '#B9B3A2',
        metal:        '#2A2D32',
        metalLight:   '#3A3E45',
        metalDark:    '#1E2124',
        metalText:    '#9A9FA6',
        wood:         '#4A2E1B',
        woodDark:     '#382214',
        woodLight:    '#5C3A24',
        paper:        '#EDE7D8',
        paperDark:    '#E1DAC6',
        ink:          '#241D15',
        inkSoft:      '#5A554A',
        crtBlack:     '#0A0E08',
        crtBlack2:    '#10170C',
        phosphor:     '#39FF14',
        amber:        '#FFB000',
        ledRed:       '#FF3B30',
        ledOff:       '#3A3E45',
      },
      fontFamily: {
        crt:  ['VT323', 'IBM Plex Mono', 'ui-monospace', 'Courier New', 'monospace'],
        mono: ['IBM Plex Mono', 'Courier New', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'raised-sm':   'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.2), 1.5px 1.5px 0 rgba(20,16,10,0.35), 2px 2px 6px rgba(20,16,10,0.2)',
        'raised-md':   'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.25), 2px 2px 0 rgba(20,16,10,0.35), 4px 4px 10px rgba(20,16,10,0.22)',
        'raised-lg':   'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.3), 3px 3px 0 rgba(20,16,10,0.32), 8px 8px 22px rgba(20,16,10,0.24)',
        'sunk':        'inset 0 3px 8px rgba(0,0,0,0.55), inset 2px 2px 6px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.16), 0 1px 0 rgba(255,255,255,0.4)',
        'sunk-deep':   'inset 0 4px 16px rgba(0,0,0,0.75), inset 3px 3px 10px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.12)',
        'pressed':     'inset 0 2px 4px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.15), 0 1px 0 rgba(20,16,10,0.3)',
        'glow-phosphor':'0 0 6px rgba(57,255,20,0.9), 0 0 16px rgba(57,255,20,0.55), 0 0 32px rgba(57,255,20,0.25)',
        'glow-amber':  'inset 0 0 0 3px rgba(255,176,0,0.9), inset 0 0 28px rgba(255,176,0,0.35), inset 0 3px 8px rgba(0,0,0,0.4)',
        'glow-red':    '0 0 6px rgba(255,59,48,0.9), 0 0 14px rgba(255,59,48,0.5)',
        'crt-glow':    '0 0 40px rgba(57,255,20,0.12)',
      },
      keyframes: {
        'crt-blink': { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
        'pulse-amber': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.75' } },
        'crt-on': {
          '0%':   { opacity: '0', filter: 'brightness(6) blur(2px)' },
          '12%':  { opacity: '1', filter: 'brightness(4)' },
          '25%':  { opacity: '0.85' },
          '40%':  { opacity: '1' },
          '55%':  { opacity: '0.92' },
          '100%': { opacity: '1', filter: 'brightness(1) blur(0)' },
        },
        'roll-line': { '0%': { top: '-10%' }, '100%': { top: '110%' } },
      },
      animation: {
        'crt-blink': 'crt-blink 1s steps(2, jump-none) infinite',
        'pulse-amber': 'pulse-amber 750ms ease-in-out infinite',
        'crt-on': 'crt-on 400ms ease-out forwards',
        'roll-line': 'roll-line 350ms linear forwards',
      },
      transitionTimingFunction: {
        tactile: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
        mech:    'cubic-bezier(0.34, 1.3, 0.5, 1)',
      },
    },
  },
};
```

**Note:** `textShadow` is not core Tailwind — either install `tailwindcss-textshadow`, or use arbitrary values like `[text-shadow:0_0_6px_rgba(57,255,20,0.7),0_0_2px_rgba(57,255,20,0.9)]`. Recommendation: define `.glow-crt` / `.glow-amber` as plain CSS utilities in `index.css` (they're used only in CRT/hopper contexts) — simpler than a plugin.

### Suggested app shell layout (for orientation only)

```
┌───────────── chassis header: POWER LED + "RETRO AI WORKBENCH" + SOUND toggle ─┐
├──────────────────────────┬───────────────────────────────────────────────────┤
│ left column (machine)    │ right column (workbench)                          │
│ ┌──────────────────────┐ │ ┌───────────────────────────────────────────────┐ │
│ │ Zone A Switchboard   │ │ │ Zone B Punch Card (prompt editor)             │ │
│ ├──────────────────────┤ │ ├───────────────────────────────────────────────┤ │
│ │ Zone C Hopper        │ │ │ Zone D CRT Terminal                           │ │
│ └──────────────────────┘ │ └───────────────────────────────────────────────┘ │
├──────────────────────────┴───────────────────────────────────────────────────┤
│ faux-wood end panels (full-height side strips, ~24px, vertical grain)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Page bg: `bg-chassis` + faint noise (`opacity 0.04` SVG turbulence) over the whole chassis.
- Faux wood: vertical grain via `repeating-linear-gradient(90deg, var(--wood) 0 14px, var(--wood-dark) 14px 15px, var(--wood-light) 15px 17px, var(--wood) 17px 28px)`.
- Breakpoints: stack to one column at `<1024px`; PWA installs at any size.

---

*ART — design system v1.0 · Ready for Dave. Open questions: (1) does the Hopper accept the punch card via internal DnD only, or also file-drop (drag a .txt prompt in)? (2) Confirm the punch-card hole grid density (80 cols vs 40 cols) after the first render at 320px.*
