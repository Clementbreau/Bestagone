# Déploiement Cloudflare Workers — Bestagone V2.1

Cette version est configurée pour **Cloudflare Workers Static Assets**, pas pour Pages.
Le frontend React est construit dans `dist/`, puis Wrangler envoie ce dossier au Worker `bestagone`.

## Configuration exacte dans Cloudflare

Dans **Workers & Pages > bestagone > Settings > Builds** :

- Production branch : `main`
- Build command : `npm run build`
- Deploy command : `npm run deploy:cloudflare`
- Root directory : vide si le projet est à la racine du dépôt

Dans **Build Variables and Secrets**, ajouter :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Ces variables sont des variables de **build**, pas des variables runtime. Le Worker ne contient que des assets statiques : le message Cloudflare disant que les runtime variables ne sont pas disponibles est donc normal.

Après avoir ajouté ou changé une variable, relancer un nouveau build/deploy. 

## Déploiement automatique par Git

Une fois le dépôt GitHub/GitLab connecté à `bestagone`, chaque push sur `main` déclenche :

1. `npm run build`
2. `npm run deploy:cloudflare`

Le fichier `vite.config.js` fait volontairement échouer le build de production si une des deux variables Supabase manque. L'erreur affichée dans les logs Cloudflare indique alors directement le nom de la variable absente.

## Déploiement manuel depuis ton ordinateur

Créer `.env.local` à partir de `.env.example`, puis :

```bash
npm install
npx wrangler login
npm run deploy
```

`npm run deploy` fait le build Vite puis `wrangler deploy`.

## Test local

```bash
npm install
cp .env.example .env.local
# remplir .env.local
npm run dev
```

Pour tester le rendu via le serveur local de Wrangler :

```bash
npm run cf:preview
```

## Si le site se déploie mais n'affiche aucune donnée

Ouvrir le navigateur sur le site puis `F12 > Console` et vérifier d'abord :

- erreur `Build interrompu...` dans Cloudflare : variables de build manquantes ;
- erreur réseau vers `*.supabase.co` : URL/clé Supabase ou réseau ;
- `401` / `403` : Auth/RLS Supabase ;
- table ou relation absente : `supabase/schema.sql` n'a pas été exécuté sur le projet Supabase concerné.
