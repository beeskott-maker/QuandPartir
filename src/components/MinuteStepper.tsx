import { Flex, IconButton, Text } from 'gestalt';

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
    <div role="group" aria-labelledby={labelId}>
      <Flex alignItems="center" gap={4}>
        <IconButton
          accessibilityLabel="Une minute de moins"
          icon="dash"
          bgColor="lightGray"
          iconColor="darkGray"
          size="lg"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
        />
        <output aria-labelledby={labelId} className="stepper-value">
          <Text size="500" weight="bold">
            {value} min
          </Text>
        </output>
        <IconButton
          accessibilityLabel="Une minute de plus"
          icon="add"
          bgColor="lightGray"
          iconColor="darkGray"
          size="lg"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
        />
      </Flex>
    </div>
  );
}
