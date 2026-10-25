# QuandPartir

Les prochains passages des trams TCL (Lyon) en temps réel, à partir du service
« prochains passages » de [data.grandlyon.com](https://data.grandlyon.com).

## Lancer l'appli

```bash
npm install
npm run dev
```

Sans identifiants, l'appli tourne en **mode démo** avec des passages fictifs.

## Accès à l'API data.grandlyon.com

L'API demande un compte data.grandlyon.com (gratuit), en authentification HTTP Basic.
Les identifiants ne doivent jamais arriver dans le navigateur : le front appelle un
**relais** qui ajoute l'authentification.

En local, ce relais est le serveur de dev de Vite (`vite.config.ts`) :

1. Copier `.env.example` en `.env.local` (ignoré par Git).
2. Renseigner `GRANDLYON_USER` et `GRANDLYON_PASSWORD`.
3. Relancer `npm run dev`.

Le front appelle alors `/api/grandlyon/...`, relayé vers
`https://data.grandlyon.com/fr/datapusher/ws/rdata/...`.

Pour une version publiée, un relais déployé (fonction serveur) sera nécessaire ;
son adresse se donne au front avec `VITE_TCL_API_URL`.

## Vérifications

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
