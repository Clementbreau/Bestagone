# Le Meilleurgone — V2.1

V2.1 de la ruche React, prête à être déployée directement sur **Cloudflare Workers Static Assets** avec Supabase comme backend partagé.

## V2.1 : ce qui change

- Le site et l'UX de la V2 sont conservés : accueil + archives en ruche, cartes hexagonales régulières, mode édition, ajout et suppression.
- Le projet n'est plus présenté comme un projet Cloudflare Pages : `wrangler.jsonc` cible directement le Worker `bestagone`.
- `dist/` est publié comme collection d'assets statiques Cloudflare Workers.
- Le mode SPA est activé via `not_found_handling: "single-page-application"`.
- Wrangler est inclus dans le projet.
- Le build de production vérifie que les deux variables Supabase sont présentes et s'arrête avec une erreur claire si elles manquent.
- Les données restent dans Supabase ; aucun `localStorage` n'est utilisé pour les Archives.

## Architecture

- React + Vite
- Cloudflare Workers Static Assets pour l'hébergement
- Supabase PostgreSQL pour les cartes
- Supabase Storage pour les images
- Supabase Auth + RLS pour protéger le mode édition

Le Worker ne contient pour l'instant aucun code serveur : c'est volontaire. Cloudflare sert directement les fichiers produits par Vite, tandis que le navigateur dialogue avec Supabase grâce à la clé publishable et aux règles RLS.

## 1. Supabase

Si la V2 fonctionne déjà avec ton projet Supabase, tu n'as rien à recréer.

Pour une installation neuve :

1. Créer un projet Supabase.
2. Ouvrir `SQL Editor`.
3. Exécuter `supabase/schema.sql`.
4. Créer les comptes administrateurs dans `Authentication > Users`.
5. Ajouter chaque UUID dans `bestagone_admins` :

```sql
insert into public.bestagone_admins (user_id)
values ('UUID_DU_COMPTE');
```

## 2. Développement local

```bash
npm install
cp .env.example .env.local
```

Remplir `.env.local` :

```env
VITE_SUPABASE_URL=https://TON_PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TA_CLE
```

Puis :

```bash
npm run dev
```

## 3. Cloudflare Workers + GitHub/GitLab

Pousser ce dossier à la racine d'un dépôt Git.

Dans **Cloudflare > Workers & Pages > bestagone > Settings > Builds** :

```text
Production branch: main
Build command: npm run build
Deploy command: npm run deploy:cloudflare
Root directory: laisser vide si le projet est à la racine
```

Dans **Build Variables and Secrets**, ajouter :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Puis pousser un commit sur `main` ou relancer le dernier déploiement.

Important : ces deux valeurs doivent être dans **Build Variables and Secrets**, pas dans les Runtime variables. Le Worker est volontairement statique ; ne pas pouvoir ajouter de runtime variables à un Worker static-assets-only est normal ici.

## 4. Déploiement manuel alternatif

Avec `.env.local` rempli :

```bash
npm install
npx wrangler login
npm run deploy
```

Le script `deploy` exécute :

```text
vite build
wrangler deploy
```

## 5. Pourquoi les variables VITE sont visibles côté navigateur

`VITE_SUPABASE_URL` et la clé **publishable** Supabase sont destinées au frontend. Elles sont intégrées au bundle JavaScript pendant le build. La protection de l'écriture repose sur Supabase Auth et les politiques RLS de `supabase/schema.sql`.

Ne jamais mettre une clé Supabase `secret` / `service_role` dans une variable `VITE_*`.

## Fichiers principaux

- `wrangler.jsonc` : configuration Cloudflare Workers Static Assets.
- `vite.config.js` : React + validation des variables de build.
- `src/main.jsx` : interface, ruche, authentification, création/suppression.
- `src/styles.css` : géométrie et direction visuelle.
- `src/supabase.js` : client Supabase.
- `supabase/schema.sql` : base, Auth/RLS et Storage.
- `CLOUDFLARE.md` : procédure de déploiement exacte.
