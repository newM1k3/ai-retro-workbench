import { useDroppable } from '@dnd-kit/core';
import type { ChannelSlug, PunchCard as Card } from '../lib/types';
import { CHANNELS, HOPPER_CAP } from '../lib/types';

interface Props {
  cards: Card[];
  hopper: string[];
  runningId: string | null;
  engaged: ChannelSlug | null;
  onEject: (id: string) => void;
}

/** Recessed dark-metal drop zone. Internal card drags only (external drops ignored). */
export function Hopper({ cards, hopper, runningId, engaged, onEject }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'hopper' });
  const queued = hopper
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is Card => Boolean(c));
  const gateOpen = engaged !== null;

  return (
    <section ref={setNodeRef} className={`panel hopper-panel ${isOver ? 'ready' : ''}`}>
      <div className="panel-label">
        <span className="plate">CARD HOPPER — FIFO {queued.length}/{HOPPER_CAP}</span>
        <span className={`gate-led ${gateOpen ? 'open' : ''}`}>
          {isOver ? 'READY TO FEED' : gateOpen ? 'GATE OPEN' : 'GATE LOCKED'}
        </span>
      </div>
      <div className="hopper-slot">
        {queued.length === 0 ? (
          <div className="hopper-empty">{isOver ? 'RELEASE TO FEED' : 'DRAG A CARD HERE TO FEED'}</div>
        ) : (
          queued.map((c, i) => {
            const running = c.id === runningId;
            const ch = c.route ? CHANNELS[c.route] : null;
            return (
              <div
                key={c.id}
                className={`hopper-card ${running ? 'feeding' : ''}`}
                style={{
                  transform: `rotate(${(i - 1) * 1.5}deg) translateY(${i * 4}px)`,
                  marginTop: i === 0 ? 0 : -22,
                }}
              >
                <span className="hc-prc">{c.prc}</span>
                {ch && (
                  <span className="hc-route" style={{ color: ch.color }}>
                    ▮ {ch.core}
                  </span>
                )}
                <span className={`hc-chip chip-${c.status.toLowerCase()}`}>{c.status}</span>
                <span className="hc-pos">POS {i + 1}</span>
                {!running && (
                  <button type="button" className="hc-eject" onClick={() => onEject(c.id)}>
                    EJECT
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="hopper-leds">
        <span className="led amber" title="feed ready" />
        <span className="led green" title="gate" />
        <span className="led red" title="fault" />
      </div>
    </section>
  );
}
