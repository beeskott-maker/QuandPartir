// Génère public/arrets.json : pour chaque ligne suivie, la liste des arrêts
// (nom -> codes d'arrêt) tirée du jeu « tcl_sytral.tclarret » de data.grandlyon.com.
// Lancé par la CI avant le build ; en local : GRANDLYON_USER=… GRANDLYON_PASSWORD=… npm run stops
import { mkdir, writeFile } from 'node:fs/promises';

const URL_ARRETS =
  'https://data.grandlyon.com/fr/datapusher/ws/rdata/tcl_sytral.tclarret/all.json?maxfeatures=5000&start=1';
// Lignes suivies par l'appli (voir src/lib/lines.ts).
const LINES = (process.env.LINES ?? 'T1').split(',').map((l) => l.trim().toUpperCase());
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

const rows = await fetchAll(process.env.STOPS_URL ?? URL_ARRETS);
const lines = {};
for (const line of LINES) {
  const byName = new Map();
  for (const row of rows) {
    if (row.id == null || !row.nom || !linesOf(row.desserte).includes(line)) continue;
    const ids = byName.get(row.nom) ?? [];
    ids.push(String(row.id));
    byName.set(row.nom, ids);
  }
  if (byName.size === 0) {
    console.error(`Aucun arrêt trouvé pour la ligne ${line} parmi ${rows.length} arrêts.`);
    console.error('Champs reçus :', Object.keys(rows[0] ?? {}).join(', '));
    console.error('Exemple :', JSON.stringify(rows[0]));
    process.exit(1);
  }
  lines[line] = [...byName]
    .map(([name, ids]) => ({ name, ids }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  console.log(`${line} : ${lines[line].length} arrêts`);
}

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), lines }));
