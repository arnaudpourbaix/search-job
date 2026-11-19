# search-job

Je veux créer une application pour suivre mes recherches d'emploi. Elle remplace l'ancien fichier Excel de suivi, dont les données ont été reprises.

L'application sera basée sur une architecture NestJS / React avec une base de données PostgreSQL hébergée sur Neon. Au niveau visuel, toute librairie UI moderne est possible mais soumise à validation.
Elle doit être utilisable sur un ordinateur et responsive pour un téléphone.

Les actions à réaliser sur une offre donnée seront gérées par un système de notification.
## Démarrage

Prérequis : Node.js 22+ et npm 11+.

```bash
npm install                        # installe tout et génère le client Prisma
cd apps/api && neon checkout dev   # lie la branche Neon « dev » et remplit apps/api/.env (DATABASE_URL…)
cd ../..
npm run db:migrate -w api          # applique les migrations sur la branche dev

npm run dev:api                    # API NestJS sur http://localhost:3000/api
npm run dev:web                    # Front React sur http://localhost:5173
```

### Connexion

L'application exige une connexion Google ; seules les adresses de `ALLOWED_EMAILS` sont acceptées.
Chaque utilisateur a ses propres données (campagnes, pistes, carnet, étapes, listes).

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → créer un projet,
   configurer l'écran de consentement (type « Externe », en mode test avec son adresse en
   utilisateur de test), puis **Créer des identifiants → ID client OAuth → Application Web**.
2. URI de redirection autorisée : `http://localhost:5173/api/auth/google/callback`
   (en production : `https://<domaine>/api/auth/google/callback`).
3. Dans `apps/api/.env` : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`
   (et `APP_URL` hors local), voir `apps/api/.env.example`.

Les données saisies avant l'arrivée des comptes sont reprises par la **première** adresse de
`ALLOWED_EMAILS`, à sa première connexion.

Sécurité : session en base (seule l'empreinte du jeton est stockée) dans un cookie `HttpOnly`,
`SameSite=Lax` (`Secure` en HTTPS) ; toutes les routes de l'API exigent une session sauf
`/api/health` et la connexion ; contrôle de l'origine des requêtes qui modifient des données ;
en-têtes `helmet` ; limitation du nombre de requêtes.

Outils : `npm run db:studio -w api` ouvre Prisma Studio pour explorer la base.

Tests e2e : `npm run test:e2e -w api` utilise la base Neon `neondb_test` de la branche courante (dev), vidée et remigrée à chaque lancement.

### Base de données : branches Neon

- **main** : production, utilisée par l'API déployée sur Vercel (https://jobs.arnaudpourbaix.fr).
- **dev** : copie de main pour le développement local ; `apps/api/.env` pointe dessus.

Les migrations se créent sur dev (`npm run db:migrate -w api`). Avant de pousser du code qui en
dépend, les appliquer sur main, par sa connexion directe et sans toucher à `.env` :

```bash
cd apps/api
DATABASE_URL_UNPOOLED="$(neon connection-string main --database-name neondb)" npx prisma migrate deploy
```

Pour repartir des données de production : `neon branches reset dev --parent`
(efface tout ce qui a été fait sur dev).

## Structure

```
apps/api   NestJS + Prisma (Postgres/Neon) – schéma dans apps/api/prisma/schema.prisma
apps/web   React + Vite + Mantine
docs       Documentation fonctionnelle
```

## Documentation

- [Tableau de bord](docs/tableau-de-bord.md) : ce que comptent les chiffres et les blocs,
  règles des relances.
- [Entretiens](docs/entretiens.md) : processus de recrutement d'une piste, statuts, raccourcis
  et lien avec l'étape du pipeline.
- [Pistes](docs/pistes.md) : lieu et itinéraire, échanges et historique d'une piste (dont les
  changements d'étape).
- [Entreprises](docs/entreprises.md) : clients et intermédiaires, adresse qui préremplit le lieu
  d'une piste.
