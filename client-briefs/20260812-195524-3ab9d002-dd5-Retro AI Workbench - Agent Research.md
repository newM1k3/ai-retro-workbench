# Retro AI Workbench - Agent Research

AGENT RESEARCH
Subject: Retro AI Workbench — Competitor Landscape, API Cost Feasibility & Local Token Security

Context: We are initializing the codebase for a standalone micro-app on the MJW Personal App Platform. The application will connect directly to a PocketBase backend and route keys via Netlify serverless functions. I need you to run a deep, targeted analysis to ensure our architecture is optimized and that we aren't reinventing a wheel that someone else has already perfected.

Specific Deliverables Required:

1. The Multi-AI Orchestrator Landscape Audit

Find and evaluate existing multi-model terminal interfaces or prompt playgrounds (e.g., LibreChat, OpenWebUI, Vercel AI Playground, or specialized developer terminal themes).

Your Task: Rank them by their visual and tactile differentiation. What are they missing that our 1980s hardware workbench metaphor solves?

Critical Question: Do any of these competitors utilize a drag-and-drop workflow or mechanical audio feedback loops, or are they all standard, flat ChatGPT clones? Find our exact unfair advantage in interface psychology.

2. API Routing & Cost Optimization Matrix

Our canonical architecture dictates routing all AI calls through serverless Netlify functions to protect API keys.

Your Task: Compile the exact API pricing (cost per 1K input/output tokens) for Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, and Z.ai GLM-5.2 based on current developer documentation.

Deliverable: Create a comparative markdown table detailing which tasks are most cost-effective on each model. Provide a specific architectural recommendation to The Architect on how we can implement auto-truncation or context window alerts so our serverless execution time doesn't time out on long outputs.

3. PocketBase Vault Security & Exploit Analysis

Per our platform standards, the app client stub must reside in src/lib/pocketbase.ts. Users may eventually save their personal API keys to their local database instance.

Your Task: Conduct a data security review of PocketBase for storing localized user configuration data.

Deliverable: Provide Dave and The Architect a clear security protocol. Can encrypted API string data be safely retrieved from a local collection stream without exposure to standard frontend logging? Are there any specific encryption patterns we should enforce inside the PocketBase data layer before production deployment?