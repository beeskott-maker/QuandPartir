/** Regroupement des lignes TCL par mode, d'après leur code. */

export interface LineGroup {
  label: string;
  lines: string[];
}

const GROUPS: { label: string; test: (line: string) => boolean }[] = [
  // Les funiculaires (F1, F2) sont rangés avec le métro, comme sur les plans TCL.
  { label: 'Métro et funiculaire', test: (line) => /^[A-D]$/.test(line) || /^F\d+$/.test(line) },
  { label: 'Tram', test: (line) => /^T\d+$/.test(line) },
  { label: 'Bus', test: () => true },
];

const byCode = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true });

/** Métro d'abord, puis tram, puis bus ; chaque groupe trié (T2 avant T10). */
export function groupLines(lines: string[]): LineGroup[] {
  const groups = GROUPS.map(({ label }) => ({ label, lines: [] as string[] }));
  for (const line of lines) {
    groups[GROUPS.findIndex((g) => g.test(line))].lines.push(line);
  }
  for (const group of groups) group.lines.sort(byCode);
  return groups.filter((group) => group.lines.length > 0);
}
