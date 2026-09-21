# Le Meilleurgone — V2

V2 React/Vite des Archives hexagonales.

## Ce qui change par rapport à la V1

- La page Archives n'a plus d'introduction : elle ouvre directement sur la ruche de cartes.
- Les cartes sont désormais des **hexagones réguliers** : pour un hexagone à sommet gauche/droite, la hauteur vaut `largeur × √3 / 2`, ce qui donne six côtés de même longueur.
- La ruche est calculée dynamiquement : chaque colonne avance de `75 %` de la largeur d'une carte et une colonne sur deux descend d'une demi-hauteur. Les cartes se touchent donc réellement.
- Plus de `localStorage` pour les archives : titres, descriptions et métadonnées sont dans PostgreSQL via Supabase ; les images sont dans Supabase Storage.
- Le mode édition est protégé par Supabase Auth.
- Seuls les comptes inscrits dans `bestagone_admins` peuvent créer ou supprimer des cartes.
- Les images sont redimensionnées côté navigateur et envoyées en WebP pour économiser le stockage.

## Architecture choisie

- **Frontend** : React + Vite.
- **Hébergement frontend** : Cloudflare Pages.
- **Base de données, authentification et stockage d'images** : Supabase.

Pour ce projet, cette combinaison permet de démarrer à très faible coût tout en gardant une vraie base partagée entre appareils et utilisateurs.

## 1. Installer le projet

```bash
npm install
```

## 2. Créer le backend Supabase

1. Crée un projet Supabase.
2. Ouvre `SQL Editor`.
3. Exécute intégralement `supabase/schema.sql`.
4. Dans `Authentication > Users`, crée les comptes qui auront le droit d'éditer.
5. Pour chaque compte, copie son UUID puis exécute :

```sql
INSERT INTO public.bestagone_admins (user_id)
VALUES ('idamettre'::uuid);
```



Le site n'expose volontairement aucun formulaire d'inscription publique.

## 3. Variables d'environnement

Copie `.env.example` vers `.env.local` :

```bash
cp .env.example .env.local
```

Puis remplis :

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Ces deux valeurs se trouvent dans les paramètres API du projet Supabase. La clé publishable (`sb_publishable_…`) est destinée au frontend ; la sécurité des opérations d'écriture est assurée par les règles RLS du fichier SQL. Ne mets jamais une clé `secret` dans Vite ou Cloudflare Pages.

## 4. Lancer en local

```bash
npm run dev
```

## 5. Déployer sur Cloudflare Pages

Le plus simple est de pousser le dossier dans un dépôt GitHub/GitLab puis de créer un projet Pages.

Paramètres de build :

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
```

Ajoute ensuite dans les variables d'environnement de Cloudflare Pages :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Puis relance le déploiement.

## Données et sécurité

La lecture des cartes est publique. L'ajout et la suppression nécessitent :

1. un utilisateur authentifié ;
2. son UUID dans la table `bestagone_admins`.

Les règles sont appliquées côté Supabase, donc masquer le bouton d'édition dans React n'est pas la seule protection.

## Fichiers principaux

- `src/main.jsx` : interface, ruche, authentification, création/suppression.
- `src/styles.css` : géométrie et direction visuelle.
- `src/supabase.js` : connexion Supabase.
- `supabase/schema.sql` : tables, RLS et Storage.
- `.env.example` : variables nécessaires.
