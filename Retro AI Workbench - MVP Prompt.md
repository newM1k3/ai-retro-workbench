# MVP Prompt - Retro AI Workbench

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