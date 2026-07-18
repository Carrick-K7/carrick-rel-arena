interface GaugeProps {
  label: string;
  value: number;
  kind: 'warmth' | 'pressure';
}

export function Gauge({ label, value, kind }: GaugeProps) {
  return (
    <div className={`gauge gauge--${kind}`}>
      <div className="gauge__label">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div
        className="gauge__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
