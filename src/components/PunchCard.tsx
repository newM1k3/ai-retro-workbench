import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { PunchCard as Card } from '../lib/types';
import { CHANNELS, estimateTokens } from '../lib/types';

interface Props {
  card: Card;
  autoFocus: boolean;
  onTextChange: (id: string, text: string) => void;
  onVoid: (id: string) => void;
  ghost?: boolean;
}

const STATUS_LABEL: Record<Card['status'], string> = {
  MINTED: 'MINTED',
  PUNCHED: 'PUNCHED',
  HELD: 'HELD',
  FEEDING: 'FEEDING',
  DONE: 'DONE',
  FAULT: 'FAULT',
};

/** Full-size punch card. Only rendered on the deck (and as a drag overlay ghost). */
export function PunchCardView({ card, autoFocus, onTextChange, onVoid, ghost }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: ghost || card.inHopper,
  });
  const [local, setLocal] = useState(card.text);
  const debounceRef = useRef<number | undefined>(undefined);
  const lpRef = useRef<number | undefined>(undefined);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const text = e.target.value;
    setLocal(text);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => onTextChange(card.id, text), 300);
  };

  const handleVoid = (): void => onVoid(card.id);

  // Grip zone is locked while the caret is active in this card's textarea.
  const gripPointerDown = (e: React.PointerEvent): void => {
    if (document.activeElement === taRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Long-press (700ms) or right-click voids the card.
  const startLongPress = (e: React.PointerEvent): void => {
    if (card.inHopper || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.closest('.card-grip')) return;
    lpRef.current = window.setTimeout(handleVoid, 700);
  };
  const cancelLongPress = (): void => window.clearTimeout(lpRef.current);

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const ch = card.route ? CHANNELS[card.route] : null;
  const sug = card.suggestedCore ? CHANNELS[card.suggestedCore] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`punch-card status-${card.status.toLowerCase()} ${ghost ? 'ghost' : ''} ${
        isDragging ? 'dragging' : ''
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!card.inHopper) handleVoid();
      }}
    >
      <div
        className="card-grip"
        {...listeners}
        {...attributes}
        onPointerDown={gripPointerDown}
        title="GRIP ZONE — drag to feed"
      >
        <span className="grip-holes" />
        <span className="grip-label">GRIP</span>
      </div>
      <div
        className="card-main"
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
      >
        <div className="card-top">
          <span className="card-prc">{card.prc}</span>
          {card.templateId && <span className="card-tpl">{card.templateId}</span>}
          <span className={`card-chip chip-${card.status.toLowerCase()}`}>
            {STATUS_LABEL[card.status]}
          </span>
          {card.inHopper && card.queuePos != null && (
            <span className="card-pos">POS {card.queuePos}/6</span>
          )}
        </div>
        {sug && (
          <div className="card-stamp" style={{ color: sug.color, borderColor: sug.color }}>
            SUGGESTED CORE: {sug.core} // {sug.label}
          </div>
        )}
        <textarea
          ref={taRef}
          className="card-text"
          value={local}
          readOnly={card.inHopper || ghost}
          autoFocus={autoFocus}
          placeholder="PUNCH TEXT HERE..."
          spellCheck={false}
          onChange={handleChange}
        />
        {ch && (
          <div className="card-route" style={{ background: ch.color }}>
            <span>
              → {ch.core} // {card.modelSnapshot ?? ch.label}
            </span>
          </div>
        )}
        <div className="card-bottom">
          <span className="card-cols">COLS: {local.length}</span>
          <span className="card-tok">≈{estimateTokens(local).toLocaleString()} TOK</span>
          {card.outputTokens != null && (
            <span className="card-out">OUT: {card.outputTokens.toLocaleString()} TOK</span>
          )}
        </div>
      </div>
    </div>
  );
}
