# Retro AI Workbench - Art

ART
Subject: Retro AI Workbench — 1980s Analog UI/UX Design System & Tactile Components

Context: Dave is initializing the React 18 + Vite + Tailwind scaffolding for local testing on Mike's rig. While The Architect handles the serverless functions and PocketBase schemas, I need you to establish the visual design system and component specs. We want this workbench to feel like a heavy, mechanical 1980s industrial terminal—beige plastic, dark faux-wood trim, tactile toggle switches, and a glowing green CRT monitor—without sacrificing modern usability or responsive layout standards.

Specific Deliverables Required:
1. The "Brutalist Hardware" Color & Style Palette
Define the core Tailwind CSS variables and utility classes for the design system.

Chassis & Body: Heavy beige plastic (#D8D3C4), brushed dark industrial gray (#2A2D32), and vintage faux-wood side panels (#4A2E1B).

Display Terminal: Deep cathode-ray black (#0A0E08) with high-contrast phosphor green text (#39FF14) and an amber status warning state (#FFB000).

Tactile Shadows & Depth: Define the CSS box-shadow presets for physical 3D elements (inset shadows for sunken slots like the Hopper; outset drop-shadows for raised buttons and toggle switches).

2. Component Design Specifications (The 4 Core Zones)
Provide detailed visual specs for Dave to translate into React components:

Zone A: The 3-Model Switchboard Panel

Design 3 physical-style heavy toggle switches labeled CLAUDE, GPT-4o, and GLM-5.2.

Each switch must have a dual visual state: OFF (darkened metallic switch) vs. ENGAGED (flipped switch with a glowing LED indicator light above it).

Zone B: The Digital Punch Card Bench

Design the IBM-style punch card UI element.

Cards should feature a subtle paper texture, notched top-right corner, monospace typewriter text for prompt titles, and a subtle grid of "punched holes" along the border for aesthetic detail.

Zone C: The Mechanical Hopper Slot

Design a recessed, dark metal drop-zone slot.

Include clear visual drag-and-drop feedback: when a card is dragged over the Hopper, the slot border should highlight with a retro amber "READY TO FEED" outline.

Zone D: The Curved CRT Terminal Display

Design the terminal window housing the AI output.

Include a subtle pure-CSS scanline overlay, curved glass bezel corners, a faint phosphor glow effect, and a blinking block cursor (_ or █) at the end of streaming text.

3. Micro-Interaction & Audio Trigger Spec
Map out the tactile feedback states (active push down, toggle flip, drag hover elevation).

Specify the exact sound effect trigger hooks for Dave to tie into local audio files:

click.wav — Switching AI models on the Switchboard.

clack-chunk.wav — Dropping a Punch Card into the Hopper.

crt-hum.wav — Terminal powering on / streaming text.