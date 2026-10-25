/** Regroupement des lignes TCL par mode, d'après leur code. */

export interface LineGroup {
  label: string;
  lines: string[];
}

export type LineMode = 'métro' | 'funiculaire' | 'tram' | 'bus';

/** Mode d'une ligne d'après son code : A–D métro, F1… funiculaire, T1… tram, le reste bus. */
export function lineMode(line: string): LineMode {
  if (/^[A-D]$/.test(line)) return 'métro';
  if (/^F\d+$/.test(line)) return 'funiculaire';
  if (/^T\d+$/.test(line)) return 'tram';
  return 'bus';
}

/** « métro D », « tram T1 », « bus C3 », « funiculaire F1 ». */
export function lineLabel(line: string): string {
  return `${lineMode(line)} ${line}`;
}

const GROUPS: { label: string; test: (line: string) => boolean }[] = [
  // Les funiculaires (F1, F2) sont rangés avec le métro, comme sur les plans TCL.
  { label: 'Métro et funiculaire', test: (line) => ['métro', 'funiculaire'].includes(lineMode(line)) },
  { label: 'Tram', test: (line) => lineMode(line) === 'tram' },
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
