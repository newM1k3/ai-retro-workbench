// Verbatim CRT copy strings. Display names are locked: CLAUDE / GPT-5.4 / GLM-5.2.

import type { ChannelSlug } from './types';
import { CHANNELS, nowTime } from './types';

const em = '\u2014'; // em dash, matches the locked copy

export const CRT = {
  NO_UNIT: `ERROR 404: NO AI CORING UNIT ENGAGED. PLEASE FLIP SWITCH TO ROUTE TELEMETRY.`,
  GATE_LOCKED: (prc: string) => `GATE LOCKED ${em} CARD ${prc} HELD IN HOPPER.`,
  ROUTE_ENGAGED: (core: string, modelLabel: string) =>
    `ROUTE ENGAGED ${em} ${core} // ${modelLabel} // GATE OPEN. AWAITING INPUT.`,
  FEEDING: (prc: string, core: string) =>
    `FEEDING CARD ${prc} \u2192 ${core}. CYCLE START ${nowTime()}.`,
  DEFERRED: (runningCore: string, nextCore: string) =>
    `ROUTE CHANGE DEFERRED ${em} ${runningCore} CYCLE IN PROGRESS. NEXT CARD ROUTES TO ${nextCore}.`,
  WARNING_117: (suggested: ChannelSlug, engaged: ChannelSlug) =>
    `WARNING 117 ${em} SUGGESTED ${CHANNELS[suggested].core}, ENGAGED ${CHANNELS[engaged].core}. FEEDING AS ENGAGED.`,
  CYCLE_COMPLETE: (prc: string, core: string, tokens: number) =>
    `CYCLE COMPLETE ${em} CARD ${prc} // ${core} // OUTPUT: ${tokens.toLocaleString()} TOKENS. EJECTED TO BENCH.`,
  EJECTED: (prc: string) => `CARD ${prc} EJECTED FROM HOPPER. NO DATA LOST.`,
  HOPPER_FULL: `HOPPER FULL ${em} 6 CARDS QUEUED. PROCESS OR EJECT BEFORE FEEDING.`,
  DECK_FULL: `DECK CAPACITY REACHED ${em} 8 CARDS. VOID OR ARCHIVE A CARD BEFORE MINTING.`,
  FAULT: (code: string, core: string, prc: string) =>
    `FAULT ${code} ${em} ${core} NO RESPONSE. CARD ${prc} MARKED FAULT. RETRY IN 30S.`,
  RESUME: (core: string, modelLabel: string, prc: string) =>
    `ROUTE ENGAGED ${em} ${core} // ${modelLabel} // GATE OPEN ${em} RESUMING FEED OF ${prc}.`,
  EMPTY_CARD: `REJECTED: CARD IS EMPTY ${em} PUNCH SOME TEXT`,
  ALREADY_IN_HOPPER: (prc: string) => `ALREADY IN HOPPER ${em} ${prc} IS RUNNING`,
  // Extra (non-locked) status lines used by the machine:
  DISENGAGED: (core: string) => `ROUTE DISENGAGED ${em} ${core} OFFLINE.`,
  QUEUED: (prc: string, pos: number) => `CARD ${prc} QUEUED IN HOPPER ${em} POSITION ${pos}.`,
  VOIDED: (prc: string) => `CARD ${prc} VOIDED ${em} PUNCHED DATA DESTROYED.`,
  FAULT_WINDOW: (prc: string, secs: number) =>
    `CARD ${prc} IN FAULT WINDOW ${em} RETRY IN ${secs}S.`,
  NON_RETRYABLE: (code: string, core: string, prc: string) =>
    `FAULT ${code} ${em} ${core} REJECTED. CARD ${prc} RETURNED TO BENCH.`,
  LINK_ESTABLISHED: (core: string, modelLabel: string, mock: boolean) =>
    `LINK ESTABLISHED ${em} ${core} // ${modelLabel} // ${mock ? 'MOCK CIRCUIT ACTIVE' : 'LIVE UNIT'}.`,
} as const;

export const BOOT_LINES = [
  `RETRO AI WORKBENCH // CORE SWITCHBOARD v1.0 // CRT ONLINE`,
  `MEM: 64K // DECK: 8 SLOTS // HOPPER: 6 // ROUTE: SINGLE-CHANNEL`,
  `FLIP A SWITCH TO ROUTE TELEMETRY. PUNCH A CARD, THEN FEED IT TO THE HOPPER.`,
  `READY.`,
];
