# search-job

Je veux créer une application pour suivre mes recherches d'emploi. Elle remplace l'ancien fichier Excel de suivi, dont les données ont été reprises.

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

Tests e2e : `npm run test:e2e -w api` utilise la base Neon `neondb_test` (même branche), vidée et remigrée à chaque lancement.


## Structure

```
apps/api   NestJS + Prisma (Postgres/Neon) – schéma dans apps/api/prisma/schema.prisma
apps/web   React + Vite + Mantine
```
