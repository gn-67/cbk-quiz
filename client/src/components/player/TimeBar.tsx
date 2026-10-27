interface Props {
  /** 0..1 fraction of time remaining. */
  fraction: number;
  /** Turns red-ish when under this fraction. */
  urgentBelow?: number;
  className?: string;
}

/** Thin shrinking bar. Pure CSS width so it is cheap to re-render 10x/sec. */
export default function TimeBar({ fraction, urgentBelow = 0.25, className }: Props) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const urgent = f < urgentBelow;
  return (
    <div className={`pl-timebar ${urgent ? 'pl-timebar--urgent' : ''} ${className ?? ''}`} role="presentation">
      <div className="pl-timebar__fill" style={{ transform: `scaleX(${f})` }} />
    </div>
  );
}
