import type { PunchCard as Card } from '../lib/types';
import { DECK_CAP } from '../lib/types';
import { TEMPLATES } from '../data/templates';
import { PunchCardView } from './PunchCard';

interface Props {
  cards: Card[];
  lastMintedId: string | null;
  onMint: () => void;
  onMintTemplate: (tplId: string) => void;
  onTextChange: (id: string, text: string) => void;
  onVoid: (id: string) => void;
}

export function Deck({
  cards,
  lastMintedId,
  onMint,
  onMintTemplate,
  onTextChange,
  onVoid,
}: Props) {
  const slots = Array.from({ length: DECK_CAP }, (_, i) =>
    cards.find((c) => c.deckSlot === i && !c.inHopper) ?? null,
  );
  const onBench = cards.filter((c) => !c.inHopper).length;
  return (
    <section className="panel deck-panel">
      <div className="panel-label">
        <span className="plate">PUNCH CARD DECK — 2×4 // {onBench}/{DECK_CAP} ON BENCH</span>
        <span className="plate">M = MINT // LONG-PRESS / RIGHT-CLICK = VOID</span>
      </div>
      <div className="deck-grid">
        {slots.map((card, i) =>
          card ? (
            <PunchCardView
              key={card.id}
              card={card}
              autoFocus={card.id === lastMintedId}
              onTextChange={onTextChange}
              onVoid={onVoid}
            />
          ) : (
            <div key={`slot-${i}`} className="empty-slot">
              <span className="slot-num">{String(i + 1).padStart(2, '0')}</span>
            </div>
          ),
        )}
      </div>
      <div className="deck-actions">
        <button type="button" className="btn btn-primary" onClick={onMint}>
          MINT CARD <kbd>M</kbd>
        </button>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="btn btn-tpl"
            title={t.description}
            onClick={() => onMintTemplate(t.id)}
          >
            {t.id} — {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
