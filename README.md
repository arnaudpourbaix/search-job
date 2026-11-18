# search-job

Je veux créer une application pour suivre mes recherches d'emploi. J'ai un fichier excel assez basique (à la racine) et il faudra améliorer les fonctionalités.

L'application sera basée sur une architecture NestJS / React avec une base de données PostgreSQL hébergée sur Neon. Au niveau visuel, toute librairie UI moderne est possible mais soumise à validation.
Elle doit être utilisable sur un ordinateur et responsive pour un téléphone.

Les actions à réaliser sur une offre donnée seront gérées par un système de notification.
## Démarrage

Prérequis : Node.js 22+ et npm 11+.

```bash
npm install                        # installe tout et génère le client Prisma
cd apps/api && neon init           # lie le projet Neon et remplit apps/api/.env (DATABASE_URL…)
cd ../..
npm run db:migrate -w api          # applique les migrations sur la base Neon

npm run dev:api                    # API NestJS sur http://localhost:3000/api
npm run dev:web                    # Front React sur http://localhost:5173
```

Outils : `npm run db:studio -w api` ouvre Prisma Studio pour explorer la base.

Tests e2e : `npm run test:e2e -w api` utilise la base Neon `neondb_test` (même branche), vidée et remigrée à chaque lancement.

### Import de l'ancien fichier Excel

```bash
npm run import:excel -w api                       # lit recherches.xlsx à la racine
npm run import:excel -w api -- autre.xlsx --reset # autre fichier, en vidant la base avant
npm run import:excel -w api -- --campaign="Mission juillet 2027"  # campagne de rattachement
```

- Les pistes importées sont rattachées à une campagne (« Mission janvier 2027 » par défaut), créée si besoin.

- L'import refuse de tourner si la base contient déjà des pistes, sauf avec `--reset`.
- Les onglets lus sont « Pistes » et « Listes » ; « Synthèse » est ignoré car tout y est calculé.
- Les dates « 1er contact » et « Dernier contact » deviennent des échanges dans le journal.
- La « Prochaine action » devient une action (marquée faite si la piste est clôturée).
- Une fourchette de TJM saisie dans les notes (« 500-600 ») est convertie en TJM min / max.

## Structure

```
apps/api   NestJS + Prisma (Postgres/Neon)– schéma dans apps/api/prisma/schema.prisma
apps/web   React + Vite + Mantine
```
