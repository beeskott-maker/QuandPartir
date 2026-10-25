import type { Passage, Stop } from './types';

/** Codes d'arrêt de chaque course, dans l'ordre de passage. */
function courses(passages: Passage[]): string[][] {
  const byCourse = new Map<string, Passage[]>();
  for (const p of passages) {
    if (!p.course) continue;
    const list = byCourse.get(p.course) ?? [];
    list.push(p);
    byCourse.set(p.course, list);
  }
  return [...byCourse.values()].map((list) =>
    list.sort((a, b) => a.departure.getTime() - b.departure.getTime()).map((p) => p.stopId),
  );
}

/**
 * Fusionne les courses en une seule séquence : la première sert de base, les
 * arrêts des suivantes s'insèrent juste après leur prédécesseur dans leur course.
 */
function mergeCourses(sequences: string[][]): string[] {
  const [base, ...others] = sequences;
  const order = [...(base ?? [])];
  for (const sequence of others) {
    sequence.forEach((id, i) => {
      if (order.includes(id)) return;
      const before = sequence.slice(0, i).reverse().find((prev) => order.includes(prev));
      order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
    });
  }
  return order;
}

/** Direction de référence : la choisie, sinon celle qui couvre le plus d'arrêts. */
function referenceDirection(passages: Passage[], direction: string): string {
  if (direction) return direction;
  const stopsByDirection = new Map<string, Set<string>>();
  for (const p of passages) {
    const ids = stopsByDirection.get(p.direction) ?? new Set();
    ids.add(p.stopId);
    stopsByDirection.set(p.direction, ids);
  }
  let best = '';
  for (const [name, ids] of stopsByDirection) {
    if (!best || ids.size > stopsByDirection.get(best)!.size || (ids.size === stopsByDirection.get(best)!.size && name < best)) {
      best = name;
    }
  }
  return best;
}

/**
 * Arrêts dans l'ordre du parcours vers la direction choisie (du terminus opposé
 * jusqu'à elle), d'après les courses en cours sur la ligne. Les courses de l'autre
 * sens, lues à l'envers, placent les arrêts que le sens choisi n'annonce plus
 * (terminus de départ…). Les arrêts qu'aucune course n'annonce suivent, triés par nom.
 */
export function orderStops(stops: Stop[], linePassages: Passage[], direction: string): Stop[] {
  const reference = referenceDirection(linePassages, direction);
  // Chaque sens a ses propres quais : on raisonne sur les noms d'arrêts.
  const nameById = new Map(stops.flatMap((s) => s.ids.map((id) => [id, s.name] as const)));
  const toNames = (ids: string[]) =>
    ids.map((id) => nameById.get(id)).filter((name, i, all): name is string => !!name && name !== all[i - 1]);
  const forward = courses(linePassages.filter((p) => p.direction === reference)).map(toNames);
  const backward = courses(linePassages.filter((p) => p.direction !== reference)).map((ids) => toNames(ids).reverse());
  const longest = (list: string[][]) => [...list].sort((a, b) => b.length - a.length);
  // La base est une course du sens choisi ; l'autre sens ne fait que compléter.
  const sequence = mergeCourses([...longest(forward), ...longest(backward)]);
  const rank = new Map(sequence.map((name, i) => [name, i]));
  const ordered = stops.filter((s) => rank.has(s.name)).sort((a, b) => rank.get(a.name)! - rank.get(b.name)!);
  return [...ordered, ...stops.filter((s) => !rank.has(s.name))];
}
