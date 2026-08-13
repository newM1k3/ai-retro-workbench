# Retro AI Workbench - the Architect

THE ARCHITECT
Subject: Retro AI Workbench — Netlify Serverless Routing & PocketBase Schema

Context: We are building a tactile, 1980s-style multi-AI orchestrator. You are responsible for ensuring Dave doesn't write spaghetti code when connecting the frontend drag-and-drop UI to the AI models. We must strictly adhere to the MJW Personal App Platform stack: React 18, Vite, Netlify Serverless Functions, and PocketBase.

Specific Deliverables Required:

The Serverless API Blueprint: Design the exact folder structure and routing logic for the Netlify Serverless Functions (e.g., netlify/functions/execute-card.ts). We cannot expose Anthropic, OpenAI, or Z.ai keys on the frontend. Write the architecture plan showing how the frontend passes the Punch Card data to this function, and how the function streams the CRT output back.

PocketBase Stub Architecture: Map out the initial collections for src/lib/pocketbase.ts. We need a schema for Prompts (the saved punch cards) containing fields for title, system_prompt, target_model (Claude/GPT/GLM), and created_at.