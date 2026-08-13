// Punch card templates — PRC-TPL-001..003. Guidance only: the suggested core
// never overrides the engaged switch (WARNING 117 at feed time if they differ).

import type { ChannelSlug } from '../lib/types';

export interface TemplateDef {
  id: string;
  label: string;
  description: string;
  suggestedCore: ChannelSlug;
  prompt: string;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'TPL-001',
    label: 'REACT SCAFFOLD',
    description: 'Component + usage example',
    suggestedCore: 'claude',
    prompt:
      'You are a senior React engineer. Scaffold a reusable data-table component with sorting, filtering, and pagination. TypeScript props, accessible markup, Tailwind styling. Output the complete component file plus a short usage example.',
  },
  {
    id: 'TPL-002',
    label: 'LONG-CONTEXT PROCESSOR',
    description: 'Summarize + actions + questions',
    suggestedCore: 'glm',
    prompt:
      'Process the attached long document and produce: (1) a 5-bullet executive summary, (2) a list of action items with owners, (3) open questions. Keep the entire source in context; do not truncate.',
  },
  {
    id: 'TPL-003',
    label: 'TEST CASE WRITER',
    description: 'Table of cases + edges',
    suggestedCore: 'gpt',
    prompt:
      'Write a thorough suite of test cases for the described feature. Cover happy path, edge cases, error states, and boundary values. Format as a table: ID, description, preconditions, steps, expected result.',
  },
];

export const templateById = (id: string): TemplateDef | undefined =>
  TEMPLATES.find((t) => t.id === id);
