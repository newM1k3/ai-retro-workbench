### The Canonical Stack

| Layer | Technology |
| :---- | :---- |
| Frontend | React 18 \+ Vite \+ TypeScript |
| Styling and UI | Tailwind CSS \+ Lucide React |
| Auth and application data | PocketBase, normally configured through `VITE_POCKETBASE_URL` |
| Hosting and server-side work | Netlify static hosting \+ Netlify Functions |
| Cross-app launch | Dashboard-driven PocketBase token handoff with `token`, `uid`, and `source=mjw-apps-dash` query parameters |
| Payments and AI where applicable | Stripe Checkout/Webhooks; Anthropic Claude, OpenAI, or Gemini through server-side functions |

