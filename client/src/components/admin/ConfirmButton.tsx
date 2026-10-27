import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** Label of the initial button. */
  label: ReactNode;
  /** Label of the confirm button (defaults to "Confirm"). */
  confirmLabel?: ReactNode;
  /** Short question shown next to confirm/cancel. */
  question?: string;
  className?: string; // classes for the initial button (e.g. "btn danger sm")
  confirmClassName?: string; // classes for the confirm button
  disabled?: boolean;
  pending?: boolean;
  title?: string;
  onConfirm: () => void | Promise<void>;
}

/**
 * Two-step inline confirmation (never window.confirm). Click once to arm,
 * then "Confirm" or "Cancel". Auto-disarms after 6 seconds.
 */
export default function ConfirmButton({
  label,
  confirmLabel = 'Confirm',
  question,
  className = 'btn danger sm',
  confirmClassName,
  disabled,
  pending,
  title,
  onConfirm,
}: Props) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 6000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  useEffect(() => {
    if (pending) setArmed(false);
  }, [pending]);

  if (!armed) {
    return (
      <button
        type="button"
        className={`${className}${pending ? ' pending' : ''}`}
        disabled={disabled || pending}
        title={title}
        onClick={() => setArmed(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="adm-confirm">
      {question && <span className="adm-confirm-q">{question}</span>}
      <button
        type="button"
        className={confirmClassName ?? className}
        disabled={disabled || pending}
        onClick={() => {
          setArmed(false);
          void onConfirm();
        }}
        autoFocus
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn ghost sm" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}
