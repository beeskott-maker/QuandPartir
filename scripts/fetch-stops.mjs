// Génère public/arrets.json : pour chaque ligne proposée dans l'appli, la liste des arrêts
// (nom -> codes d'arrêt et position moyenne des quais) tirée du jeu « tcl_sytral.tclarret » de data.grandlyon.com.
// Lancé par la CI avant le build ; en local : GRANDLYON_USER=… GRANDLYON_PASSWORD=… npm run stops
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ARRETS =
  'https://data.grandlyon.com/fr/datapusher/ws/rdata/tcl_sytral.tclarret/all.json?maxfeatures=5000&start=1';
// Lignes proposées : toutes les lignes du réseau, ou la liste LINES=A,T1,C3.
const LINES_ENV = process.env.LINES?.split(',').map((l) => l.trim().toUpperCase());
const OUTPUT = new URL('../public/arrets.json', import.meta.url);

const { GRANDLYON_USER: user, GRANDLYON_PASSWORD: password } = process.env;
if (!user || !password) {
  console.error('GRANDLYON_USER et GRANDLYON_PASSWORD sont nécessaires.');
  process.exit(1);
}
const headers = {
  Accept: 'application/json',
  Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
};

/** Toutes les lignes du jeu de données, en suivant la pagination « next ». */
async function fetchAll(url) {
  const rows = [];
  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Erreur ${response.status} sur ${url}`);
    const body = await response.json();
    rows.push(...(body.values ?? []));
    url = body.values?.length ? body.next : null;
  }
  return rows;
}

/** « T1:A,T1:R,C22:A » -> ['T1', 'C22'] */
function linesOf(desserte) {
  return String(desserte ?? '')
    .split(/[,;]/)
    .map((token) => token.split(':')[0].trim().toUpperCase())
    .filter(Boolean);
}

/** Position moyenne des quais, arrondie (~1 m). */
function center(coords) {
  if (!coords.length) return {};
  const mean = (i) => Math.round((coords.reduce((sum, c) => sum + c[i], 0) / coords.length) * 1e5) / 1e5;
  return { lat: mean(0), lon: mean(1) };
}

const rows = await fetchAll(process.env.STOPS_URL ?? URL_ARRETS);
const LINES =
  LINES_ENV ??
  [...new Set(rows.flatMap((row) => linesOf(row.desserte)))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
if (LINES.length === 0) {
  console.error(`Aucune ligne trouvée parmi ${rows.length} arrêts.`);
  console.error('Exemple :', JSON.stringify(rows[0]));
  process.exit(1);
}
const lines = {};
for (const line of LINES) {
  const byName = new Map();
  for (const row of rows) {
    if (row.id == null || !row.nom || !linesOf(row.desserte).includes(line)) continue;
    const stop = byName.get(row.nom) ?? { ids: [], coords: [] };
    stop.ids.push(String(row.id));
    if (Number.isFinite(row.lat) && Number.isFinite(row.lon)) stop.coords.push([row.lat, row.lon]);
    byName.set(row.nom, stop);
  }
  if (byName.size === 0) {
    console.error(`Aucun arrêt trouvé pour la ligne ${line} parmi ${rows.length} arrêts.`);
    console.error('Champs reçus :', Object.keys(rows[0] ?? {}).join(', '));
    console.error('Exemple :', JSON.stringify(rows[0]));
    process.exit(1);
  }
  lines[line] = [...byName]
    .map(([name, { ids, coords }]) => ({ name, ids, ...center(coords) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
console.log(`${LINES.length} lignes : ${LINES.map((line) => `${line} (${lines[line].length})`).join(', ')}`);

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), lines }));
