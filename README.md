# search-job

Je veux créer une application pour suivre mes recherches d'emploi. J'ai un fichier excel assez basique (à la racine) et il faudra améliorer les fonctionalités.

L'application sera basée sur une architecture NestJS / React avec une base de données SQLite. Au niveau visuel, toute librairie UI moderne est possible mais soumise à validation.
Elle doit être utilisable sur un ordinateur et responsive pour un téléphone.

Les actions à réaliser sur une offre donnée seront gérées par un système de notification.
## Démarrage

Prérequis : Node.js 22+ et npm 11+.

```bash
npm install                        # installe tout et génère le client Prisma
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w api          # crée/actualise la base SQLite (apps/api/dev.db)

npm run dev:api                    # API NestJS sur http://localhost:3000/api
npm run dev:web                    # Front React sur http://localhost:5173
```

Outils : `npm run db:studio -w api` ouvre Prisma Studio pour explorer la base.

## Structure

```
apps/api   NestJS + Prisma (SQLite)    – schéma dans apps/api/prisma/schema.prisma
apps/web   React + Vite + Mantine
```
