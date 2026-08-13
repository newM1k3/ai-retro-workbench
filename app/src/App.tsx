import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CHANNELS, DECK_CAP, HOPPER_CAP } from './lib/types';
import { initAudio } from './lib/fx';
import { pbReachable } from './lib/pocketbase';
import { useWorkbench } from './state/useWorkbench';
import { Switchboard } from './components/Switchboard';
import { Deck } from './components/Deck';
import { Hopper } from './components/Hopper';
import { CrtTerminal } from './components/CrtTerminal';
import { PunchCardView } from './components/PunchCard';

export default function App() {
  const printRef = useRef<((t: string) => void) | null>(null);
  const clearRef = useRef<(() => void) | null>(null);
  const wb = useWorkbench(printRef);
  const { state } = wb;

  const [dragId, setDragId] = useState<string | null>(null);
  const [pbOnline, setPbOnline] = useState<boolean | null>(null);

  // M key mints a card (ignored while typing in a card body).
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      if (e.key === 'm' || e.key === 'M') wb.mintCard();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [wb.mintCard]);

  // Web Audio autoplay policy: init on the first user gesture.
  useEffect(() => {
    const start = (): void => initAudio();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);

  // PocketBase reachability probe (indicator only; writes degrade to localStorage).
  useEffect(() => {
    let alive = true;
    void pbReachable().then((ok) => {
      if (alive) setPbOnline(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    setDragId(String(e.active.id));
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDragId(null);
      if (e.over && String(e.over.id) === 'hopper') {
        wb.feedCard(String(e.active.id));
      }
    },
    [wb.feedCard],
  );

  const runningCard =
    state.runningId ? (state.cards.find((c) => c.id === state.runningId) ?? null) : null;
  const runLabel =
    runningCard && runningCard.route
      ? `${CHANNELS[runningCard.route].core} // ${
          runningCard.modelSnapshot ?? CHANNELS[runningCard.route].label
        } // RUNNING`
      : null;
  const dragCard = dragId ? (state.cards.find((c) => c.id === dragId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div className="chassis">
        <header className="brand-bar">
          <h1>RETRO AI WORKBENCH</h1>
          <div className="brand-status">
            <span className={`led ${pbOnline === true ? 'green' : pbOnline === false ? 'red' : ''}`} />
            <span className="bs-label">PB</span>
            <span className="sep" />
            <span className={`led ${state.runningId ? 'amber' : ''}`} />
            <span className="bs-label">BUS</span>
            <span className="sep" />
            <span className="bs-label">DECK {state.cards.length}/{DECK_CAP}</span>
            <span className="sep" />
            <span className="bs-label">HOPPER {state.hopper.length}/{HOPPER_CAP}</span>
          </div>
        </header>

        <Switchboard engaged={state.engaged} onToggle={wb.toggleSwitch} />

        <Deck
          cards={state.cards}
          lastMintedId={state.lastMintedId}
          onMint={wb.mintCard}
          onMintTemplate={wb.mintTemplate}
          onTextChange={wb.updateCardText}
          onVoid={wb.voidCard}
        />

        <Hopper
          cards={state.cards}
          hopper={state.hopper}
          runningId={state.runningId}
          engaged={state.engaged}
          onEject={wb.ejectCard}
        />

        <CrtTerminal
          printRef={printRef}
          clearRef={clearRef}
          streaming={state.runningId !== null}
          runLabel={runLabel}
          onAbort={wb.abort}
        />
      </div>
      <DragOverlay>
        {dragCard && (
          <PunchCardView
            card={{ ...dragCard }}
            autoFocus={false}
            onTextChange={() => {}}
            onVoid={() => {}}
            ghost
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
