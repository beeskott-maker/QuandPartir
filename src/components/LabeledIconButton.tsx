import { IconButton, Text } from 'gestalt';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof IconButton> & {
  /** Texte affiché au-dessus du bouton, à la hauteur des libellés des menus voisins. */
  label: string;
};

/** Bouton icône avec un libellé visible, aligné sur un menu Gestalt placé à côté. */
export function LabeledIconButton({ label, ...props }: Props) {
  return (
    <div className="labeled-icon-button">
      <span className="labeled-icon-button-label" aria-hidden="true">
        <Text size="100" align="center">
          {label}
        </Text>
      </span>
      <IconButton {...props} />
    </div>
  );
}
