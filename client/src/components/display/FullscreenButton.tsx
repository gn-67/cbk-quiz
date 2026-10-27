import { useCallback, useEffect, useRef, useState } from 'react';

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function isFullscreen(): boolean {
  const d = document as FsDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

export function toggleFullscreen() {
  try {
    const d = document as FsDoc;
    const el = document.documentElement as FsEl;
    if (isFullscreen()) {
      const p = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
      void Promise.resolve(p).catch(() => {});
    } else {
      const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
      void Promise.resolve(p).catch(() => {});
    }
  } catch {
    /* ignore — fullscreen is best-effort */
  }
}

const IDLE_MS = 3000;

/**
 * Unobtrusive fullscreen toggle: fades out after a few seconds of no pointer activity,
 * reappears on mouse movement. Pressing "f" anywhere (outside inputs) also toggles.
 */
export default function FullscreenButton() {
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);
  const timer = useRef<number | null>(null);

  const poke = useCallback(() => {
    setIdle(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    poke();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    const onFsChange = () => setFs(isFullscreen());
    window.addEventListener('mousemove', poke);
    window.addEventListener('pointerdown', poke);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    setFs(isFullscreen());
    return () => {
      window.removeEventListener('mousemove', poke);
      window.removeEventListener('pointerdown', poke);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [poke]);

  return (
    <button
      type="button"
      className={`dp-fs${idle ? ' idle' : ''}`}
      onClick={toggleFullscreen}
      title={fs ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
      aria-label={fs ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {fs ? (
          <>
            <path d="M9 4v5H4" /><path d="M15 4v5h5" /><path d="M9 20v-5H4" /><path d="M15 20v-5h5" />
          </>
        ) : (
          <>
            <path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" />
          </>
        )}
      </svg>
      <span>{fs ? 'Exit' : 'Fullscreen'}</span>
      <kbd>F</kbd>
    </button>
  );
}
