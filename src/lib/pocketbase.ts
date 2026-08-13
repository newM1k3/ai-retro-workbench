// PocketBase client + typed helpers for the `Prompts` collection.
// Unreachable PocketBase degrades gracefully: every helper returns null/false and
// the app falls back to localStorage persistence (deck drafts persist from day one).

import PocketBase from 'pocketbase';
import type { ChannelSlug } from './types';

export type TargetModel = ChannelSlug;

export interface PromptRecord {
  id: string;
  title: string;
  prompt: string;
  system_prompt?: string;
  target_model: TargetModel;
  favorite: boolean;
  created: string;
  updated: string;
}

export interface PromptInput {
  title: string;
  prompt: string;
  system_prompt?: string;
  target_model: TargetModel;
  favorite?: boolean;
}

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090');
pb.autoCancellation(false);

const COLLECTION = 'Prompts';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('pocketbase timeout')), ms);
    }),
  ]);
}

/** Cheap reachability probe — gates all PB writes. */
export async function pbReachable(timeoutMs = 1500): Promise<boolean> {
  try {
    await withTimeout(pb.health.check(), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

export async function listPrompts(): Promise<PromptRecord[] | null> {
  try {
    return await withTimeout(pb.collection(COLLECTION).getFullList<PromptRecord>(), 4000);
  } catch {
    return null;
  }
}

export async function createPrompt(input: PromptInput): Promise<PromptRecord | null> {
  try {
    return await withTimeout(pb.collection(COLLECTION).create<PromptRecord>(input), 4000);
  } catch {
    return null;
  }
}

export async function updatePrompt(
  id: string,
  input: Partial<PromptInput>,
): Promise<PromptRecord | null> {
  try {
    return await withTimeout(pb.collection(COLLECTION).update<PromptRecord>(id, input), 4000);
  } catch {
    return null;
  }
}

export async function deletePrompt(id: string): Promise<boolean> {
  try {
    await withTimeout(pb.collection(COLLECTION).delete(id), 4000);
    return true;
  } catch {
    return false;
  }
}
