# QuandPartir

Les prochains passages des trams TCL (Lyon) en temps réel, à partir du service
« prochains passages » de [data.grandlyon.com](https://data.grandlyon.com).

## Lancer l'appli

```bash
npm install
npm run dev
```

L'appli appelle le relais en ligne https://api.quandpartir.workers.dev, y compris
en local. Pour travailler sur des passages fictifs, sans appel à l'API, mettre
`VITE_TCL_API_URL=demo` dans `.env.local` (voir `.env.example`).

## Accès à l'API data.grandlyon.com

L'API demande un compte data.grandlyon.com, en authentification HTTP Basic.
Les identifiants ne doivent jamais arriver dans le navigateur : le front appelle un
**relais**, un Cloudflare Worker (dossier `worker/`), qui ajoute l'authentification.

- Grand Lyon n'est interrogé que **ligne par ligne** (`field=ligne&value=…`),
  jamais sur tout le réseau. La ligne vient du paramètre `ligne` : celle que
  l'utilisateur a choisie dans l'appli (choix obligatoire).
- Les lignes proposées (toutes les lignes de tram, ou `LINES=T1,T2`) et leurs arrêts
  (nom -> codes d'arrêt et position, jeu `tcl_sytral.tclarret`)
  est générée à chaque déploiement par `scripts/fetch-stops.mjs` dans
  `public/arrets.json` et publiée avec le site : l'appli ne la demande pas à l'API.
  En local : `GRANDLYON_USER=… GRANDLYON_PASSWORD=… npm run stops`.
- Le relais filtre ensuite par arrêt, garde chaque ligne 20 s en mémoire, n'expose
  que le jeu de données des prochains passages et n'autorise que les origines listées
  dans `worker/wrangler.toml`.

## Déploiement

Chaque push sur `main` lance la CI (`.github/workflows/deploy.yml`) : lint, types,
tests, build, déploiement du Worker, puis publication sur GitHub Pages à
https://beeskott-maker.github.io/QuandPartir/.

Secrets GitHub nécessaires (Settings → Secrets and variables → Actions) :
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GRANDLYON_USER`, `GRANDLYON_PASSWORD`.

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
