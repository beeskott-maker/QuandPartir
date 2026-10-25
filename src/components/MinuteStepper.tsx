interface Props {
  /** id de l'élément qui sert de libellé au réglage. */
  labelId: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** Nombre de minutes réglé avec un bouton moins et un bouton plus. */
export function MinuteStepper({ labelId, value, min, max, onChange }: Props) {
  return (
    <div className="stepper" role="group" aria-labelledby={labelId}>
      <button type="button" aria-label="Une minute de moins" onClick={() => onChange(value - 1)} disabled={value <= min}>
        −
      </button>
      <output aria-labelledby={labelId}>{value} min</output>
      <button type="button" aria-label="Une minute de plus" onClick={() => onChange(value + 1)} disabled={value >= max}>
        +
      </button>
    </div>
  );
}
