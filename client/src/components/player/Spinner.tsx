interface Props {
  label?: string;
}

export default function Spinner({ label = 'Connecting…' }: Props) {
  return (
    <div className="pl-spinner-wrap" role="status" aria-live="polite">
      <div className="pl-spinner" aria-hidden="true" />
      <div className="pl-spinner-label">{label}</div>
    </div>
  );
}
