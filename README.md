# grossiste_ppn

Application Grossiste PPN : gestion de grossiste avec backend Express/PostgreSQL et interface React installable, conçue pour une utilisation hors ligne.

## Structure

- `database/schema.sql` : schéma PostgreSQL initial.
- `BACK-END/` : API Express, authentification JWT, validation Zod et accès PostgreSQL.
- `FRONT-END/` : application React/Vite, cache IndexedDB avec Dexie et configuration PWA.

Les modules métier sont séparés. Les modules dont les règles métier ne sont pas encore développées renvoient volontairement une réponse HTTP 501.

## Démarrage

1. Créez une base PostgreSQL nommée `grossiste_ppn`, puis exécutez `database/schema.sql`.
2. Dans `BACK-END`, copiez `.env.example` en `.env` et renseignez les paramètres PostgreSQL ainsi qu’un secret JWT aléatoire d’au moins 32 caractères.
3. Lancez le backend avec `npm run dev` depuis `BACK-END`.
4. Dans `FRONT-END`, copiez `.env.example` en `.env` si l’API n’est pas à `http://localhost:3001/api`, puis lancez `npm run dev`.

Les dépendances sont séparées par application. Le backend écoute sur `http://localhost:3001` (port choisi car PostgreSQL utilise déjà le port 3000 sur cette machine) et le frontend est servi sur `http://localhost:5173`.

## Vérification

- Backend : `npm test` depuis `BACK-END`.
- Frontend : `npm run build` depuis `FRONT-END`.

Le dépôt ignore les fichiers `.env`; ne les publiez jamais. `.env.example` ne contient que des valeurs de développement.