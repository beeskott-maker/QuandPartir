/**
 * Direction suivante : l'autre terminus quand la ligne en a deux ; s'il y en a
 * davantage (services partiels), on passe au suivant de la liste.
 */
export function otherDirection(directions: string[], current: string): string {
  const index = directions.indexOf(current);
  return directions[(index + 1) % directions.length];
}
