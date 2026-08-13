import type { CSSProperties } from 'react';
import type { ChannelSlug } from '../lib/types';
import { CHANNEL_LIST } from '../lib/types';

interface Props {
  engaged: ChannelSlug | null;
  onToggle: (slug: ChannelSlug) => void;
}

/** Single-channel radio with snap-back: engaging one disengages the other. */
export function Switchboard({ engaged, onToggle }: Props) {
  const active = engaged ? CHANNEL_LIST.find((c) => c.slug === engaged) ?? null : null;
  return (
    <section className="panel switchboard-panel">
      <div className="panel-label">
        <span className="plate">CORE SWITCHBOARD — SINGLE CHANNEL</span>
        <span
          className="engage-status"
          style={{ color: active ? active.color : '#7a7466' }}
        >
          {active ? `${active.core} ENGAGED` : 'NO UNIT ENGAGED'}
        </span>
      </div>
      <div className="switches">
        {CHANNEL_LIST.map((ch) => {
          const on = engaged === ch.slug;
          return (
            <button
              key={ch.slug}
              type="button"
              className={`switch ${on ? 'on' : ''}`}
              onClick={() => onToggle(ch.slug)}
              style={{ '--core': ch.color } as CSSProperties}
              aria-pressed={on}
            >
              <span className="switch-fascia">
                <span className="switch-lever" />
                <span className="switch-led" />
              </span>
              <span className="switch-label">{ch.label}</span>
              <span className="switch-core">{ch.core}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
