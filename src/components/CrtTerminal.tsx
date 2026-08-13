import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { BOOT_LINES } from '../lib/crt';
import { useCrt } from '../hooks/useCrt';

interface Props {
  printRef: MutableRefObject<((t: string) => void) | null>;
  clearRef: MutableRefObject<(() => void) | null>;
  streaming: boolean;
  runLabel: string | null;
  onAbort: () => void;
}

/**
 * Dominant CRT terminal. Single <pre>-style node updated via textContent —
 * no per-character setState, no dangerouslySetInnerHTML. Blinking block cursor
 * is pure CSS (::after). Scanlines + glass bezel are pure CSS overlays.
 */
export function CrtTerminal({ printRef, clearRef, streaming, runLabel, onAbort }: Props) {
  const crt = useCrt();
  const bootedRef = useRef(false);

  useEffect(() => {
    printRef.current = crt.print;
    clearRef.current = crt.clear;
  }, [crt.print, crt.clear, printRef, clearRef]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    for (const line of BOOT_LINES) crt.print(line + '\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={`crt ${streaming ? 'streaming' : ''}`}>
      <div className="crt-bezel">
        <div className="crt-header">
          <span className="crt-title">CRT-100 // PHOSPHOR MONITOR</span>
          <span className="crt-run">{runLabel ?? 'AWAITING INPUT'}</span>
          <span className={`crt-led ${streaming ? 'on' : ''}`}>●</span>
          {streaming && (
            <button type="button" className="crt-abort" onClick={onAbort}>
              ABORT
            </button>
          )}
          <button
            type="button"
            className="crt-clear"
            onClick={() => {
              crt.clear();
              for (const l of BOOT_LINES) crt.print(l + '\n');
            }}
          >
            CLR
          </button>
        </div>
        <div className="crt-screen">
          <pre ref={crt.preRef} className="crt-body">
            <span ref={crt.textRef} />
          </pre>
        </div>
        <div className="crt-footer">
          <span>25S CLIENT CAP // 20S UPSTREAM CAP</span>
          <span>SCANLINE CRT // OVERFLOW-WRAP ANYWHERE // NO H-SCROLL</span>
        </div>
      </div>
    </section>
  );
}
