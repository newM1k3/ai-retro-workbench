# The Retro AI Workbench: Elaborated

The Core Concept: This isn’t just a UI; it’s a psychological shift. Instead of a sleek, frictionless modern dashboard that encourages rapid, thoughtless prompting, this PWA forces intentionality. It looks and sounds like a heavy 1980s control desk—think beige plastic, faux-wood paneling, heavy clacking sounds, and glowing green CRT text.

The Mechanics:

The "Punch Cards" (Task Definition): You don't just type into a chat box. You click "Mint Card," which gives you a blank, digital IBM-style punch card. You type your prompt (e.g., "Build the React scaffolding for the Kawartha app") onto the card.

The "Switchboard" (Model Routing): Next to the hopper are physical-looking toggle switches or plug-jacks labeled with your heavy hitters: Claude, GPT-4o, and GLM-5.2. You flip the switch for the AI whose strengths best match the task. (For example, routing a massive 1-million token lore document to GLM-5.2).

The "Hopper" (Execution): You drag the punch card into the Hopper slot. The app plays a satisfying, mechanical clack-chunk sound effect. This triggers the Netlify Serverless Function on the backend to fire off the API call.

The CRT Terminal (Output): The AI's response doesn't just instantly appear. It prints out on a simulated curved CRT monitor using a fast, rhythmic typewriter effect.

The Vibe-Coding Bridge:
Before you take code into Bolt.new for live rendering, you can use this PWA as your "Prompt Sandbox." You generate, refine, and stress-test the logic using multiple AIs here, and then export the finalized, perfect code block directly to your clipboard.

The AutoClaw MVP Prompt
Copy and paste this directly into your chat with Bubbles 🦞. It includes all your strict canonical stack rules so Dave and The Architect know exactly what to do.

[ROLE & OBJECTIVE]
You are an expert Full-Stack AI Developer. Your task is to build a functional MVP for the "Retro AI Workbench," a Progressive Web App (PWA) designed to orchestrate multiple AI API calls through a nostalgic, 1980s analog interface. Ensure the project is initialized cleanly so it is ready to be version-controlled and pushed to the newM1k3 GitHub repository.

[STRICT TECH STACK CONSTRAINTS]

Frontend: React 18 + Vite + TypeScript.

Styling: Tailwind CSS + Lucide React icons.

Hosting: Netlify (static hosting + Netlify Serverless Functions).

Backend: PocketBase ONLY.

Forbidden Tech: SUPABASE IS STRICTLY FORBIDDEN. Do not import, install, or reference @supabase/supabase-js.

Architecture Mandate: The app must include a src/lib/pocketbase.ts file exporting an initialized PocketBase client connecting to import.meta.env.VITE_POCKETBASE_URL.

[CORE MVP FEATURES]

The Punch Card System: Implement a drag-and-drop UI (using HTML5 DnD or a lightweight React library). Users can create a "Card," type text into it, and drag it into a designated "Hopper" drop-zone.

The Switchboard: Create a panel with three distinct toggle switches (labeled Claude, GPT, GLM-5.2). Only one can be active at a time. This state determines which AI model the prompt is intended for.

The Execution Trigger: When a card is dropped into the Hopper, trigger a mock API call (simulating the eventual Netlify Serverless Function) and change the UI state to "Processing."

The CRT Terminal: A dedicated display area that takes the mock API response and renders it character-by-character (a typewriter effect) inside a dark terminal window.

[AESTHETICS & UI]

Vibe: 1980s Analog Hardware / Brutalist Retro. It must feel tactile and heavy.

Colors: Beige/grey plastics, dark faux-wood accents, and glowing CRT green (#39FF14) for the terminal text.

Typography: A monospace pixel font for the terminal, and bold, utilitarian sans-serif (like Helvetica) for the machine labels.

UI Elements: Use heavy CSS drop-shadows (inset and outset) to make buttons, switches, and the hopper look like physical 3D objects, not flat web components.

[IMMEDIATE DELIVERABLES]

Generate the React + Vite scaffolding.

Set up the src/lib/pocketbase.ts stub.

Build the core layout: The Switchboard panel, the Punch Card drag-and-drop zone, and the CRT Terminal.

Apply the strict analog Tailwind CSS styles.
