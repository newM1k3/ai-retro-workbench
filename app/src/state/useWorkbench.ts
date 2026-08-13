// Workbench state machine: deck ⇄ hopper ⇄ CRT, single-channel switchboard,
// mock-first execution. All mutators read the latest state from a ref and are
// event-driven (no concurrent mutation), so no reducer middleware is needed.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ChannelSlug, PunchCard } from '../lib/types';
import {
  AUTO_SAVE_MS,
  CHANNELS,
  DECK_CAP,
  FAULT_WINDOW_MS,
  HOPPER_CAP,
  estimateTokens,
  uid,
} from '../lib/types';
import { CRT } from '../lib/crt';
import { clack, click, startCrtHum, stopCrtHum } from '../lib/fx';
import { executeCard } from '../lib/api';
import { templateById } from '../data/templates';
import { createPrompt, deletePrompt, updatePrompt } from '../lib/pocketbase';
import defaultSeed from '../data/default-cards.json';

const STORAGE_KEY = 'retro-ai-workbench:state:v1';

export interface WorkbenchState {
  cards: PunchCard[];
  /** FIFO queue of card ids currently in the hopper. */
  hopper: string[];
  engaged: ChannelSlug | null;
  runningId: string | null;
  lastMintedId: string | null;
}

interface SeedCard {
  title: string;
  target_model: string;
  suggested_core?: string;
  token_estimate?: number;
  prompt: string;
}
interface SeedFile {
  version: number;
  cards: SeedCard[];
}

function coreNameToSlug(core?: string): ChannelSlug | null {
  if (core === 'CORE-A') return 'claude';
  if (core === 'CORE-B') return 'gpt';
  if (core === 'CORE-C') return 'glm';
  return null;
}

function seedState(): WorkbenchState {
  const cards: PunchCard[] = (defaultSeed as SeedFile).cards.map((s, i) => ({
    id: uid(),
    prc: `PRC-${String(i + 1).padStart(4, '0')}`,
    title: s.title,
    text: s.prompt,
    status: 'PUNCHED',
    deckSlot: i,
    inHopper: false,
    queuePos: null,
    route: null,
    modelSnapshot: null,
    suggestedCore: coreNameToSlug(s.suggested_core) ?? (s.target_model as ChannelSlug),
    tokenEstimate: s.token_estimate,
    createdAt: Date.now() + i,
  }));
  return { cards, hopper: [], engaged: null, runningId: null, lastMintedId: null };
}

function loadInitial(): WorkbenchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<WorkbenchState>;
      if (Array.isArray(p.cards) && Array.isArray(p.hopper)) {
        const ids = new Set((p.cards as PunchCard[]).map((c) => c.id));
        const hopper = (p.hopper as string[]).filter((id) => ids.has(id));
        const hopperSet = new Set(hopper);
        const cards: PunchCard[] = (p.cards as PunchCard[]).map((c) => {
          const inHopper = hopperSet.has(c.id);
          const pos = hopper.indexOf(c.id);
          let status = c.status;
          // A FEEDING job never survives a page reload — return the card to its slot.
          if (inHopper && status === 'FEEDING') status = 'HELD';
          if (!inHopper && (status === 'FEEDING' || status === 'HELD')) {
            status = c.text.trim() ? 'PUNCHED' : 'MINTED';
          }
          return { ...c, inHopper, queuePos: inHopper ? pos + 1 : null, status };
        });
        const engaged =
          p.engaged && CHANNELS[p.engaged as ChannelSlug]
            ? (p.engaged as ChannelSlug)
            : null;
        return { cards, hopper, engaged, runningId: null, lastMintedId: null };
      }
    }
  } catch {
    // corrupted storage → reseed
  }
  return seedState();
}

export interface Workbench {
  state: WorkbenchState;
  mintCard: () => void;
  mintTemplate: (tplId: string) => void;
  updateCardText: (id: string, text: string) => void;
  voidCard: (id: string) => void;
  feedCard: (id: string) => void;
  ejectCard: (id: string) => void;
  toggleSwitch: (slug: ChannelSlug) => void;
  abort: () => void;
}

export function useWorkbench(
  printRef: MutableRefObject<((t: string) => void) | null>,
): Workbench {
  const [state, setState] = useState<WorkbenchState>(loadInitial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const print = useCallback((t: string) => printRef.current?.(t), [printRef]);
  const abortRef = useRef<() => void>(() => undefined);
  const abortedRef = useRef(false);

  // ---------- execution (SSE, one network call per run) ----------
  const finishRun = useCallback(
    (id: string, opts: { status: 'DONE' | 'FAULT' | 'PUNCHED'; faultUntil?: number }) => {
      stopCrtHum();
      const st = stateRef.current;
      const idx = st.hopper.indexOf(id);
      const hopper = idx < 0 ? st.hopper : st.hopper.filter((x) => x !== id);
      const cards: PunchCard[] = st.cards.map((c) => {
        if (c.id !== id) {
          if (c.inHopper) return { ...c, queuePos: hopper.indexOf(c.id) + 1 || null };
          return c;
        }
        return {
          ...c,
          inHopper: false,
          queuePos: null,
          status: opts.status,
          faultUntil: opts.faultUntil,
          lastErrorCode: opts.status === 'FAULT' ? 'UPSTREAM' : c.lastErrorCode,
        };
      });
      const runningId = st.runningId === id ? null : st.runningId;
      const next: WorkbenchState = { ...st, cards, hopper, runningId };
      setState(next);
      // FIFO: auto-start the next queued card if a route is still engaged.
      if (next.engaged && next.runningId === null && hopper.length > 0) {
        const front = cards.find((c) => c.id === hopper[0]);
        if (front) {
          const ch = CHANNELS[next.engaged];
          setState({
            ...next,
            runningId: front.id,
            cards: next.cards.map((c) =>
              c.id === front.id
                ? { ...c, status: 'FEEDING', queuePos: 1, route: next.engaged, modelSnapshot: ch.label }
                : c,
            ),
          });
          print(CRT.FEEDING(front.prc, ch.core) + '\n');
          runExecution(front.id, next.engaged);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [print],
  );

  const runExecution = useCallback(
    (id: string, route: ChannelSlug) => {
      const st = stateRef.current;
      const card = st.cards.find((c) => c.id === id);
      if (!card) return;
      const ch = CHANNELS[route];
      startCrtHum();
      abortedRef.current = false;
      abortRef.current = executeCard({
        prompt: card.text,
        targetModel: route,
        temperature: 0.4,
        maxTokens: 1024,
        onMeta: (m) =>
          print(
            CRT.LINK_ESTABLISHED(m.core ?? ch.core, m.model ?? ch.label, m.mock === true) + '\n',
          ),
        onDelta: (d) => print(d),
        onDone: (info) => {
          if (abortedRef.current) {
            print(`TRANSMISSION ABORTED — CARD ${card.prc} RETURNED TO BENCH.\n`);
            finishRun(id, { status: 'PUNCHED' });
            return;
          }
          setState((prev) => ({
            ...prev,
            cards: prev.cards.map((c) =>
              c.id === id ? { ...c, outputTokens: info.tokens } : c,
            ),
          }));
          print(CRT.CYCLE_COMPLETE(card.prc, ch.core, info.tokens) + '\n');
          finishRun(id, { status: 'DONE' });
        },
        onError: (err) => {
          if (abortedRef.current) {
            print(`TRANSMISSION ABORTED — CARD ${card.prc} RETURNED TO BENCH.\n`);
            finishRun(id, { status: 'PUNCHED' });
            return;
          }
          if (err.retryable) {
            print(CRT.FAULT(err.code, ch.core, card.prc) + '\n');
            if (err.message) print(`>> ${err.message}\n`);
            finishRun(id, { status: 'FAULT', faultUntil: Date.now() + FAULT_WINDOW_MS });
          } else {
            print(CRT.NON_RETRYABLE(err.code, ch.core, card.prc) + '\n');
            if (err.message) print(`>> ${err.message}\n`);
            finishRun(id, { status: 'PUNCHED' });
          }
        },
      });
    },
    [finishRun, print],
  );

  // ---------- abort control ----------
  const abort = useCallback(() => {
    abortedRef.current = true;
    abortRef.current();
  }, []);

  // ---------- hopper ----------
  const feedCard = useCallback(
    (id: string) => {
      const st = stateRef.current;
      const card = st.cards.find((c) => c.id === id);
      if (!card) return;
      if (card.inHopper) {
        print(CRT.ALREADY_IN_HOPPER(card.prc) + '\n');
        return;
      }
      if (!card.text.trim()) {
        print(CRT.EMPTY_CARD + '\n');
        return;
      }
      if (card.status === 'FAULT' && card.faultUntil && Date.now() < card.faultUntil) {
        const secs = Math.max(1, Math.ceil((card.faultUntil - Date.now()) / 1000));
        print(CRT.FAULT_WINDOW(card.prc, secs) + '\n');
        return;
      }
      if (st.hopper.length >= HOPPER_CAP) {
        print(CRT.HOPPER_FULL + '\n');
        return;
      }
      const engaged = st.engaged;
      const pos = st.hopper.length + 1;
      const immediate = engaged !== null && st.runningId === null;
      const next: WorkbenchState = {
        ...st,
        cards: st.cards.map((c) =>
          c.id === id
            ? {
                ...c,
                inHopper: true,
                queuePos: pos,
                status: immediate ? 'FEEDING' : 'HELD',
                route: immediate && engaged ? engaged : c.route,
                modelSnapshot:
                  immediate && engaged ? CHANNELS[engaged].label : c.modelSnapshot,
              }
            : c,
        ),
        hopper: [...st.hopper, id],
        runningId: immediate ? id : st.runningId,
      };
      setState(next);
      clack();
      if (immediate && engaged) {
        const ch = CHANNELS[engaged];
        if (card.suggestedCore && card.suggestedCore !== engaged) {
          print(CRT.WARNING_117(card.suggestedCore, engaged) + '\n');
        }
        print(CRT.FEEDING(card.prc, ch.core) + '\n');
        runExecution(id, engaged);
      } else if (!engaged) {
        print(CRT.NO_UNIT + '\n');
        print(CRT.GATE_LOCKED(card.prc) + '\n');
      } else {
        print(CRT.QUEUED(card.prc, pos) + '\n');
      }
    },
    [print, runExecution],
  );

  const ejectCard = useCallback(
    (id: string) => {
      const st = stateRef.current;
      const card = st.cards.find((c) => c.id === id);
      if (!card || !card.inHopper) return;
      if (st.runningId === id) return; // never eject an in-flight card
      print(CRT.EJECTED(card.prc) + '\n');
      const hopper = st.hopper.filter((x) => x !== id);
      const cards: PunchCard[] = st.cards.map((c) =>
        c.id === id
          ? {
              ...c,
              inHopper: false,
              queuePos: null,
              status: c.text.trim() ? 'PUNCHED' : 'MINTED',
            }
          : c.inHopper
            ? { ...c, queuePos: hopper.indexOf(c.id) + 1 || null }
            : c,
      );
      setState({ ...st, cards, hopper });
    },
    [print],
  );

  // ---------- switchboard ----------
  const resumeQueued = useCallback(
    (st: WorkbenchState, engaged: ChannelSlug) => {
      const front = st.hopper.length > 0 ? st.cards.find((c) => c.id === st.hopper[0]) : undefined;
      if (!front) return;
      const ch = CHANNELS[engaged];
      setState({
        ...st,
        runningId: front.id,
        cards: st.cards.map((c) =>
          c.id === front.id
            ? { ...c, status: 'FEEDING', queuePos: 1, route: engaged, modelSnapshot: ch.label }
            : c,
        ),
      });
      print(CRT.RESUME(ch.core, ch.label, front.prc) + '\n');
      runExecution(front.id, engaged);
    },
    [print, runExecution],
  );

  const toggleSwitch = useCallback(
    (slug: ChannelSlug) => {
      click();
      const st = stateRef.current;
      if (st.engaged === slug) {
        // snap-back: disengage
        setState({ ...st, engaged: null });
        print(CRT.DISENGAGED(CHANNELS[slug].core) + '\n');
        return;
      }
      const ch = CHANNELS[slug];
      if (st.runningId) {
        // never abort an in-flight job — deferred route change
        const running = st.cards.find((c) => c.id === st.runningId);
        const runningCore = running?.route ? CHANNELS[running.route].core : ch.core;
        setState({ ...st, engaged: slug });
        print(CRT.DEFERRED(runningCore, ch.core) + '\n');
        return;
      }
      const next: WorkbenchState = { ...st, engaged: slug };
      setState(next);
      if (st.hopper.length > 0) {
        resumeQueued(next, slug);
      } else {
        print(CRT.ROUTE_ENGAGED(ch.core, ch.label) + '\n');
      }
    },
    [print, resumeQueued],
  );

  // ---------- deck ----------
  const mintCard = useCallback(() => {
    const st = stateRef.current;
    if (st.cards.length >= DECK_CAP) {
      print(CRT.DECK_FULL + '\n');
      return;
    }
    const used = new Set(st.cards.map((c) => c.deckSlot));
    const slot = Array.from({ length: DECK_CAP }, (_, i) => i).find((s) => !used.has(s));
    if (slot === undefined) {
      print(CRT.DECK_FULL + '\n');
      return;
    }
    const maxNum = st.cards.reduce((m, c) => {
      const n = Number.parseInt(c.prc.replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    const card: PunchCard = {
      id: uid(),
      prc: `PRC-${String(maxNum + 1).padStart(4, '0')}`,
      text: '',
      status: 'MINTED',
      deckSlot: slot,
      inHopper: false,
      queuePos: null,
      route: null,
      modelSnapshot: null,
      createdAt: Date.now(),
    };
    setState({ ...st, cards: [...st.cards, card], lastMintedId: card.id });
  }, [print]);

  const mintTemplate = useCallback(
    (tplId: string) => {
      const tpl = templateById(tplId);
      if (!tpl) return;
      const st = stateRef.current;
      if (st.cards.length >= DECK_CAP) {
        print(CRT.DECK_FULL + '\n');
        return;
      }
      const used = new Set(st.cards.map((c) => c.deckSlot));
      const slot = Array.from({ length: DECK_CAP }, (_, i) => i).find((s) => !used.has(s));
      if (slot === undefined) {
        print(CRT.DECK_FULL + '\n');
        return;
      }
      const card: PunchCard = {
        id: uid(),
        prc: `PRC-${tpl.id}`,
        title: tpl.label,
        templateId: tpl.id,
        text: tpl.prompt,
        status: 'PUNCHED',
        deckSlot: slot,
        inHopper: false,
        queuePos: null,
        route: null,
        modelSnapshot: null,
        suggestedCore: tpl.suggestedCore,
        tokenEstimate: estimateTokens(tpl.prompt),
        createdAt: Date.now(),
      };
      setState({ ...st, cards: [...st.cards, card], lastMintedId: card.id });
    },
    [print],
  );

  const voidCard = useCallback(
    (id: string) => {
      const st = stateRef.current;
      const card = st.cards.find((c) => c.id === id);
      if (!card || card.inHopper) return;
      setState({ ...st, cards: st.cards.filter((c) => c.id !== id) });
      print(CRT.VOIDED(card.prc) + '\n');
      if (card.pbId) void deletePrompt(card.pbId);
    },
    [print],
  );

  const updateCardText = useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === id
          ? {
              ...c,
              text,
              status: c.inHopper ? c.status : text.trim() ? 'PUNCHED' : 'MINTED',
              outputTokens: undefined,
              lastErrorCode: undefined,
              faultUntil: undefined,
            }
          : c,
      ),
    }));
  }, []);

  // ---------- persistence ----------
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            cards: state.cards,
            hopper: state.hopper,
            engaged: state.engaged,
            runningId: state.runningId,
          }),
        );
      } catch {
        // private mode / quota — localStorage is best-effort
      }
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  // Best-effort PocketBase sync (fire-and-forget; graceful fallback to localStorage).
  const pbBlockedUntilRef = useRef(0);
  useEffect(() => {
    if (Date.now() < pbBlockedUntilRef.current) return;
    const t = window.setTimeout(() => {
      const syncCards = state.cards.filter(
        (c) => c.title && c.text.trim() && c.status !== 'FEEDING' && !c.inHopper,
      );
      if (syncCards.length === 0) return;
      void (async () => {
        for (const c of syncCards) {
          const input = {
            title: c.title as string,
            prompt: c.text,
            target_model: c.route ?? c.suggestedCore ?? 'claude',
            favorite: false,
          };
          try {
            if (c.pbId) {
              const rec = await updatePrompt(c.pbId, input);
              if (!rec) throw new Error('pb unreachable');
            } else {
              const rec = await createPrompt(input);
              if (!rec) throw new Error('pb unreachable');
              setState((prev) => ({
                ...prev,
                cards: prev.cards.map((x) => (x.id === c.id ? { ...x, pbId: rec.id } : x)),
              }));
            }
          } catch {
            pbBlockedUntilRef.current = Date.now() + 60_000;
            break;
          }
        }
      })();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [state]);

  // Abort any in-flight job when the workbench unmounts.
  useEffect(() => {
    return () => abortRef.current();
  }, []);

  return {
    state,
    mintCard,
    mintTemplate,
    updateCardText,
    voidCard,
    feedCard,
    ejectCard,
    toggleSwitch,
    abort,
  };
}
