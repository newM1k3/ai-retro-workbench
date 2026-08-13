# Retro AI Workbench

Retro AI Workbench is a browser-based prompt console styled like a 1980s electronics bench. Instead of a conventional chat window, users prepare reusable “punch cards,” queue them in a hopper, select an AI provider on a switchboard, and watch the response arrive in a CRT-style terminal.

The application is **mock-first**: it can demonstrate the complete interaction without paid API keys. When server-side credentials are configured, the same Netlify function can stream responses from Anthropic, OpenAI, or Z.ai. PocketBase synchronization is optional; the browser falls back to local storage when PocketBase is unavailable.

> **Project status:** This repository contains a working MVP. The core card, queue, model-selection, streaming-output, local-persistence, and installable PWA flows are implemented. The Card File archive and some production-hardening work remain future improvements.

## What the application does

| Capability | Current behavior |
|---|---|
| Punch-card deck | Starts with reusable prompt cards and supports creating, editing, moving, and voiding cards. |
| Hopper | Queues up to six cards for first-in, first-out execution. |
| Provider switchboard | Selects Anthropic, OpenAI, or Z.ai adapters. |
| CRT terminal | Displays streamed Server-Sent Events with a typewriter-style presentation. |
| Mock mode | Produces canned streamed output when forced or when a configured provider key is unavailable. |
| Persistence | Saves browser state locally and attempts best-effort PocketBase synchronization when configured. |
| PWA support | Includes a web manifest and service worker for installable, offline-friendly static assets. |

## How it is organized

The runtime application currently appears twice: once at the repository root and once under `app/`. The two copies are synchronized in the current version. Root-level deployment configuration makes the **repository root the simplest working directory** for development and Netlify deployment; changes should remain synchronized until the duplicate layout is removed.

```text
.
├── src/
│   ├── components/       # Switchboard, deck, hopper, cards, and CRT UI
│   ├── data/             # Default cards and prompt templates
│   ├── hooks/            # CRT streaming and presentation behavior
│   ├── lib/              # API, PocketBase, sound, formatting, and shared types
│   └── state/            # Workbench state machine and persistence
├── netlify/functions/    # Server-side provider adapters and SSE endpoint
├── public/               # PWA manifest, service worker, and icon
├── app/                  # Mirrored copy of the runtime application
├── deliverables/         # Product, design, architecture, QA, and research notes
├── client-briefs/        # Original specialist briefs
├── netlify.toml          # Build, function, redirect, and SPA configuration
└── package.json          # Frontend scripts and dependencies
```

The main data flow is straightforward: the React interface sends a card execution request to `/api/execute-card`; Netlify redirects that request to `netlify/functions/execute-card.ts`; the function selects a mock or live provider adapter; and response events stream back to the CRT. Workbench state is stored in `localStorage`, with PocketBase writes attempted when the configured service is reachable.

## Technology

| Area | Technology |
|---|---|
| Interface | React 18, TypeScript, Tailwind CSS |
| Build tooling | Vite 6, npm |
| Drag and drop | `@dnd-kit/core` and `@dnd-kit/utilities` |
| Server-side endpoint | Netlify Functions |
| Streaming protocol | Server-Sent Events |
| Optional persistence | PocketBase plus local-storage fallback |
| Installability | Web app manifest and service worker |

## Requirements

Use a current Node.js LTS release; **Node.js 20 or newer is recommended**. npm is included with Node.js. To exercise the serverless endpoint locally, use the Netlify CLI. PocketBase and real provider credentials are optional because mock fallback is enabled by default.

## Quick start

```bash
git clone https://github.com/newM1k3/ai-retro-workbench.git
cd ai-retro-workbench
npm ci
cp .env.example .env
npm run dev
```

Vite prints the local browser URL, normally `http://localhost:5173`. Running only `npm run dev` serves the frontend; card execution through `/api/execute-card` requires the Netlify development proxy.

For the complete mock execution flow, stop the standalone Vite process and run:

```bash
npx netlify-cli dev
```

The app can operate without PocketBase. If `VITE_POCKETBASE_URL` is unreachable, state remains in the current browser through local storage.

## Environment variables

Copy `.env.example` to `.env` for local work. Variables beginning with `VITE_` are embedded in the browser bundle; provider credentials must **never** use that prefix.

| Variable | Scope | Required | Purpose |
|---|---|---:|---|
| `VITE_POCKETBASE_URL` | Browser | No | PocketBase base URL. Local storage remains available when it is absent or unreachable. |
| `ANTHROPIC_API_KEY` | Server only | No | Enables live Anthropic requests. |
| `OPENAI_API_KEY` | Server only | No | Enables live OpenAI requests. |
| `ZAI_API_KEY` | Server only | No | Enables live Z.ai requests. |
| `ANTHROPIC_MODEL` | Server only | No | Overrides the default Anthropic model identifier. |
| `OPENAI_MODEL` | Server only | No | Overrides the default OpenAI model identifier. |
| `ZAI_MODEL` | Server only | No | Overrides the default Z.ai model identifier. |
| `MOCK_AI` | Server only | No | Set to `true` to force mock responses for every provider. |
| `ALLOW_MOCK_FALLBACK` | Server only | No | When `true`, missing provider credentials fall back to mock output. |

Treat `.env.example` as documentation only. Do not commit a populated `.env` file or expose provider credentials to client-side code.

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend development server. |
| `npm run build` | Type-check the project and create a production build in `dist/`. |
| `npm run preview` | Serve the completed production build locally. |
| `npx netlify-cli dev` | Run the frontend and Netlify function routing together. |

## Production build

```bash
npm ci
npm run build
```

The generated static site is written to `dist/`. The checked-in `netlify.toml` publishes that directory, bundles functions from `netlify/functions`, routes `/api/*` to the execution function, and sends other unmatched paths to the single-page application.

## Netlify deployment

Connect the repository to Netlify and use the root directory with the checked-in build settings. Add provider credentials and model overrides as **server-side environment variables** in Netlify rather than as `VITE_` variables. Mock mode can remain enabled for demonstrations that do not need live provider traffic.

If PocketBase is used in production, set `VITE_POCKETBASE_URL` to the deployed PocketBase origin and configure that service’s collection rules independently. The current client intentionally degrades to local-only persistence when synchronization fails.

## Validation

Before merging a change, run the reproducible install, build, and dependency audit:

```bash
npm ci
npm run build
npm audit
```

Because the runtime is duplicated under `app/`, also verify that relevant application files remain synchronized or deliberately document a layout change.

## Known limitations and review priorities

| Priority | Improvement |
|---|---|
| High | Add prompt-size limits, request throttling, and stronger abuse controls to the serverless endpoint before exposing live providers broadly. |
| High | Remove the duplicated root/`app/` runtime layout so there is one canonical source tree and lockfile. |
| Medium | Add automated tests for deck-to-hopper transitions, SSE parsing, provider errors, and persistence fallback. |
| Medium | Surface PocketBase synchronization state instead of silently treating remote writes as best effort. |
| Medium | Revisit touch drag-and-drop behavior and keyboard accessibility on mobile devices. |
| Low | Align provider-configuration error status codes and upstream-error redaction with the product blueprint. |
| Low | Implement the deferred Card File/archive and favorite-card features. |

## Additional project documentation

The repository includes detailed product, design, architecture, DevOps, research, and QA material. Start with `handover.md`, `build-handover.md`, and `deliverables/qa-execution-report.md` when planning deeper changes.

## License

No license file is currently included. Until the owner selects a license, normal copyright restrictions apply.
