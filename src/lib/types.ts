// Shared domain types for the Retro AI Workbench.

export type ChannelSlug = 'claude' | 'gpt' | 'glm';

export interface Channel {
  slug: ChannelSlug;
  /** Switchboard label (display name per lock: GPT-5.4, not GPT-4O). */
  label: string;
  core: string;
  color: string;
  /** API model name sent to the backend. */
  model: string;
  /** Environment variable that holds this provider's key. */
  keyEnv: string;
}

export const CHANNELS: Record<ChannelSlug, Channel> = {
  claude: {
    slug: 'claude',
    label: 'CLAUDE',
    core: 'CORE-A',
    color: '#FFB020',
    model: 'claude-sonnet-5',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  gpt: {
    slug: 'gpt',
    label: 'GPT-5.4',
    core: 'CORE-B',
    color: '#3DDC68',
    model: 'gpt-5.4',
    keyEnv: 'OPENAI_API_KEY',
  },
  glm: {
    slug: 'glm',
    label: 'GLM-5.2',
    core: 'CORE-C',
    color: '#35C4E8',
    model: 'glm-5.2',
    keyEnv: 'ZAI_API_KEY',
  },
};

export const CHANNEL_LIST: Channel[] = [CHANNELS.claude, CHANNELS.gpt, CHANNELS.glm];

export const coreOf = (slug: ChannelSlug): string => CHANNELS[slug].core;

export type CardStatus = 'MINTED' | 'PUNCHED' | 'HELD' | 'FEEDING' | 'DONE' | 'FAULT';

export interface PunchCard {
  id: string;
  /** PRC-#### for hand-punched cards, PRC-TPL-00X for template cards. */
  prc: string;
  title?: string;
  templateId?: string;
  text: string;
  status: CardStatus;
  /** Original deck slot (0-7). Card returns here after ejection. */
  deckSlot: number;
  inHopper: boolean;
  queuePos: number | null;
  /** Route stripe, sampled from the engaged switch at FEED time. */
  route: ChannelSlug | null;
  /** Model display name snapshotted at dispatch (never mutates mid-run). */
  modelSnapshot: string | null;
  /** Template guidance only — never overrides the engaged switch. */
  suggestedCore?: ChannelSlug | null;
  tokenEstimate?: number;
  outputTokens?: number;
  lastErrorCode?: string;
  faultUntil?: number;
  pbId?: string;
  createdAt: number;
}

export const DECK_CAP = 8;
export const HOPPER_CAP = 6;
export const FAULT_WINDOW_MS = 30_000;
export const AUTO_SAVE_MS = 300;

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function nowTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
