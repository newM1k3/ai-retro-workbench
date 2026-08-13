# Retro AI Workbench - devops

TO: DEVOPS
Subject: Retro AI Workbench — CI/CD Pipeline & Netlify Config

Context: We need a seamless path from Dave's local machine to a live staging environment. You own the deployment pipeline to the MJW platform infrastructure.

Specific Deliverables Required:

The netlify.toml Configuration: Write the exact build settings required for this Vite + React 18 project. Ensure the serverless function directories are correctly targeted and the redirects for the single-page application (SPA) routing are flawless.

Environment Variable Checklist: Create the .env.example file structure. It must include the placeholder hooks for VITE_POCKETBASE_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, and ZAI_API_KEY so the newM1k3 GitHub repository doesn't accidentally leak secrets on the first commit.
