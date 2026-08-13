# DevOps Deliverable — Retro AI Workbench

**Stack:** Vite + React 18 + TypeScript PWA · Tailwind CSS · Lucide React · Netlify (static + Serverless Functions) · PocketBase backend (Supabase FORBIDDEN)
**Repo target:** `newM1k3` (GitHub)
**Prepared by:** DevOps · **Date:** 2026-08-12 · **Status:** Ready for Dave to drop in verbatim

---

## 1. `netlify.toml` (drop at repo root)

```toml
# ============================================================
# Retro AI Workbench — netlify.toml
# Vite + React 18 + TypeScript PWA
# Netlify Serverless Functions (netlify/functions/)
# ============================================================

[build]
  command = "npm run build"
  publish = "dist"               # Vite default outDir
  functions = "netlify/functions"

[build.environment]
  # Node LTS for install + build. Also becomes the DEFAULT runtime
  # for serverless functions (they inherit the build Node version).
  # 22 = current LTS (Node 20 is EOL — do not use).
  NODE_VERSION = "22"
  # Pin the functions runtime explicitly so it can't silently fall
  # back to the platform default. Valid values: nodejs18.x |
  # nodejs20.x | nodejs22.x | nodejs24.x
  AWS_LAMBDA_JS_RUNTIME = "nodejs22.x"

# ------------------------------------------------------------
# Serverless functions — esbuild bundling
# ------------------------------------------------------------
# esbuild is Netlify's default bundler and compiles TypeScript
# natively. execute-card.ts needs NO separate tsc/compile step:
# just export `handler` and drop the file in netlify/functions/.
[functions]
  node_bundler = "esbuild"

# Per-function tweaks — only if you ever need them:
# [functions."execute-card"]
#   node_bundler = "esbuild"
#   external_node_modules = []            # keep a dep OUT of the bundle (rare)
#   included_files = ["assets/*.json"]    # ship non-imported files alongside the bundle

# ------------------------------------------------------------
# Redirects — ORDER MATTERS: functions first, then SPA catch-all
# ------------------------------------------------------------
# 1) Function routes: explicit passthrough so /.netlify/functions/*
#    always reaches the function runtime and is NEVER swallowed by
#    the SPA rewrite below. (Netlify matches functions before
#    redirects anyway; this makes the intent explicit + future-proof.)
[[redirects]]
  from = "/.netlify/functions/*"
  to = "/.netlify/functions/:splat"
  status = 200

# Optional pretty alias: /api/cards -> /.netlify/functions/cards
# [[redirects]]
#   from = "/api/*"
#   to = "/.netlify/functions/:splat"
#   status = 200

# 2) SPA catch-all: every unknown route serves index.html with a 200.
#    DO NOT add `force = true` here — force would rewrite REAL assets
#    (/assets/*.js, /favicon.svg, /manifest.webmanifest) to index.html
#    and break the PWA. Without force, existing files win; only
#    missing paths fall through to index.html. This is the "flawless"
#    SPA behavior: deep links refresh correctly, assets still load.
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# ------------------------------------------------------------
# PWA caching headers (recommended)
# ------------------------------------------------------------
# The service worker must never be cached by the browser itself.
[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

# Vite hashed assets (dist/assets/*.[hash].js|css) are immutable.
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Function bundling notes (esbuild + TypeScript) — for Dave

- **No compile step.** esbuild transpiles `.ts` natively at deploy time. `netlify/functions/execute-card.ts` just needs:
  ```ts
  import type { Handler } from "@netlify/functions";
  export const handler: Handler = async (event, context) => {
    // read process.env.ANTHROPIC_API_KEY / OPENAI_API_KEY / ZAI_API_KEY here
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  };
  ```
- **Dependencies** declared in the root `package.json` are auto-bundled into the function zip. Keep the function lean; don't import React/Tailwind stuff into it.
- **Node built-ins** (`fetch`, `crypto`, `process.env`) are available at runtime — `fetch` is global on Node 22.
- **Type safety:** esbuild strips types without checking them. Make sure `netlify/functions/**` is included in `tsconfig.json` so the template's `tsc && vite build` type-checks the functions too. (Vite's default tsconfig includes only `src/` — extend the include array.)
- **API keys are read via `process.env` inside the handler only** — never imported into client code, never `VITE_`-prefixed.

---

## 2. Environment variable checklist

### 2a. `.env.example` (commit this file exactly)

```env
# ============================================================
# Retro AI Workbench — Environment Variables
# ============================================================
# 1. Copy to `.env` for local dev:
#      PowerShell:  Copy-Item .env.example .env
#      bash:        cp .env.example .env
# 2. `.env` is gitignored — NEVER commit it. Only `.env.example`
#    (placeholders, no real values) is committed.
# 3. Push the SAME variables to Netlify in the dashboard (see 2c).
# ============================================================

# ------------------------------------------------------------
# PUBLIC — safe as VITE_ (inlined into the browser bundle)
# ------------------------------------------------------------
# Anything prefixed VITE_ is baked into the client JS at build time
# and readable by ANYONE via DevTools. Only non-secrets go here.
# A PocketBase URL is not a secret — the client app needs it to
# talk to the backend directly.
#
# Local dev default (PocketBase running on your machine):
VITE_POCKETBASE_URL=http://127.0.0.1:8090
# Production example (hosted PocketBase):
# VITE_POCKETBASE_URL=https://retro-ai-workbench.pockethost.io

# ------------------------------------------------------------
# SECRET — SERVER-SIDE ONLY. NEVER use a VITE_ prefix.
# ------------------------------------------------------------
# These are read ONLY inside Netlify Functions (execute-card) via
# process.env. They are never shipped to the browser.
#
# ⚠️ If you prefix any of these with VITE_, Vite inlines them into
# the public bundle and they leak to every visitor. This is the #1
# secret-leak in Vite apps. Don't do it.
#
# Set them in Netlify with scope "Functions" (see 2c). For local
# dev, `netlify dev` loads them from `.env`. Leave blank if you
# don't use a given provider.

# Anthropic (Claude)
ANTHROPIC_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Z.ai (GLM)
ZAI_API_KEY=
```

### 2b. VITE_ (public) vs server-only — the rule

| Variable | Prefix | Where it lives | Safe? |
|---|---|---|---|
| `VITE_POCKETBASE_URL` | `VITE_` | Inlined into client bundle; used by browser code | ✅ Public by design |
| `ANTHROPIC_API_KEY` | (none) | `process.env` inside Netlify Functions only | 🔒 Must NEVER be `VITE_` |
| `OPENAI_API_KEY` | (none) | `process.env` inside Netlify Functions only | 🔒 Must NEVER be `VITE_` |
| `ZAI_API_KEY` | (none) | `process.env` inside Netlify Functions only | 🔒 Must NEVER be `VITE_` |

Golden rule: **`VITE_` prefix = shipped to the browser = public.** Only the PocketBase URL qualifies.

### 2c. Netlify UI setup steps

1. **Netlify dashboard → your site → Site configuration → Environment variables** (older UI: Settings → Build & deploy → Environment).
2. Click **Add a variable → Add a single variable** (or use the bulk editor for the three API keys).
3. Add these four variables with these **scopes** (least privilege — this matters):

   | Variable | Value | Scope |
   |---|---|---|
   | `VITE_POCKETBASE_URL` | your PocketBase URL | **Builds** *(must exist when `npm run build` runs — Vite inlines it then)* |
   | `ANTHROPIC_API_KEY` | real key | **Functions** |
   | `OPENAI_API_KEY` | real key | **Functions** |
   | `ZAI_API_KEY` | real key | **Functions** |

   - "Builds" scope = available only during build (Vite inlining).
   - "Functions" scope = available only to serverless functions at runtime — **never in build logs, never in the bundle, never in the repo**.
   - "All scopes" works but is wider than needed; keep API keys on Functions only.
4. **Save** → env changes take effect on the **next deploy** — trigger a deploy (or push).
5. **Verify after deploy:** see §3 Step 3 below.

---

## 3. Secret-safety checklist for the `newM1k3` repo

### 3a. `.gitignore` (commit this file exactly — at repo root)

```gitignore
# ---------- Dependencies ----------
node_modules/

# ---------- Build output (Vite) ----------
dist/
dist-ssr/
coverage/
*.tsbuildinfo
.vite/

# ---------- Environment files ----------
# Real env files are NEVER committed. Only the placeholder
# .env.example is. (Order matters: the ! negation must come
# after .env.* — it does.)
.env
.env.*
!.env.example
.env.local
.env.*.local

# ---------- Netlify ----------
.netlify/

# ---------- Logs ----------
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# ---------- Editor / OS ----------
.vscode/*
!.vscode/extensions.json
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
.DS_Store
Thumbs.db
```

### 3b. Hard rules (no exceptions)

1. **`.env.example` is the ONLY env file that gets committed.** Real `.env` / `.env.local` / `.env.production` are gitignored and live only on your machine and in the Netlify dashboard.
2. **Zero hardcoded keys** in source, config, docs, or commit messages. API keys never appear in `src/`, `netlify/`, `package.json`, or README.
3. **API keys are never `VITE_`-prefixed** — that's how they'd end up in the public bundle (see §2b).
4. **No real keys in chat logs / issues** that might get pasted into the repo later.
5. **If a key leaks: rotate it immediately** — regenerate in the provider console (Anthropic / OpenAI / Z.ai), update Netlify + local `.env`, and treat the old key as compromised even after deletion. Pre-first-push leaks are easy: fix, don't push, move on.

### 3c. 3-step verification BEFORE the first push (and every push after)

**Step 1 — Grep scan for secrets.** Run from the repo root; must return **zero real hits** (review any hits manually — e.g. `apiKey` in a test file that reads from env is fine, a literal `sk-...` string is not).

*PowerShell (native):*
```powershell
Get-ChildItem -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|dist|\.netlify)\\' } |
  Select-String -Pattern 'sk-[A-Za-z0-9_-]{20,}', 'AIza[0-9A-Za-z_-]{30,}', 'api[_-]?key\s*[:=]', 'Bearer\s+[A-Za-z0-9._-]{20,}' |
  Select-Object Path, LineNumber, Line
```

*Git Bash:*
```bash
grep -rniE 'sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|api[_-]?key[[:space:]]*[:=]|Bearer[[:space:]]+[A-Za-z0-9._-]{20,}' \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.netlify .
```

*Extra tip:* also grep for your real key prefixes once you have them, e.g. `sk-ant-` (Anthropic), `sk-proj-` (OpenAI), or the Z.ai key prefix.

**Step 2 — Git status review.** Confirm exactly what's staged:

```powershell
git status
git diff --stat          # unstaged changes
git diff --cached --stat # staged changes
git ls-files | Select-String -Pattern '\.env|secret|credential|key'   # PowerShell
git ls-files | grep -iE '\.env|secret|credential|key'                 # Git Bash
```

Expected results:
- ✅ `git ls-files` shows **only `.env.example`** among env files — no `.env`, `.env.local`, `.env.production`.
- ✅ `node_modules/`, `dist/`, `.netlify/` are **not** tracked.
- ✅ No `secret` / `credential` / `key`-named files other than `.env.example`.
- ✅ Read the full staged diff once (`git diff --cached`) — eyeball every line before the first commit.

**Step 3 — Netlify env config + post-deploy proof.**

1. Netlify UI shows all 4 vars with correct scopes (§2c) — `VITE_POCKETBASE_URL` on **Builds**, the 3 API keys on **Functions**. Nothing secret lives in the repo.
2. After the first deploy, open the live site → **DevTools → Sources → search all files** for `sk-ant-`, `sk-proj-`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ZAI_API_KEY` → expect **0 hits** (the bundle must not contain them).
3. Hit the function endpoint directly — it must return your JSON, **not** the SPA `index.html`:
   ```
   https://<your-site>.netlify.app/.netlify/functions/execute-card
   ```
   (If you enabled the `/api/*` alias: `https://<your-site>.netlify.app/api/execute-card`.)
4. Refresh a deep route (e.g. `/cards`) — should load the PWA via the SPA rewrite, proving the redirects work.

*Optional hardening (later):* a pre-commit hook (Husky) running the Step-1 grep, or `git-secrets`. Nice-to-have, not required for the first commit.

---

## Quick file summary for Dave

| File | Where | Status |
|---|---|---|
| `netlify.toml` | repo root | verbatim from §1 |
| `.env.example` | repo root | verbatim from §2a |
| `.gitignore` | repo root | verbatim from §3a |
| Env vars | Netlify dashboard UI | manual, §2c (Builds vs Functions scopes) |
