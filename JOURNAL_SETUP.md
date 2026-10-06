# FRAGMENTS — installation

La nouvelle page est intégrée au même projet React/Vite, mais n'a **aucun lien** avec l'interface du Meilleurgone.

## 1. Choisir l'adresse

Par défaut :

```text
https://ton-domaine.fr/fragments
```

Pour la changer, ajoute dans Cloudflare > Build Variables and Secrets :

```env
VITE_JOURNAL_PATH=/ton-chemin-prive
```

Le chemin sert à garder la page discrète. La vraie protection de l'édition reste Supabase Auth + RLS.

## 2. Créer la table des articles

Dans Supabase > SQL Editor, exécute :

```text
supabase/journal.sql
```

Le script est non destructif et réutilise `bestagone_admins`.

## 3. Activer le mot de passe d'édition

Le bouton `Édition` n'affiche qu'un champ mot de passe. En arrière-plan, il connecte ton compte Supabase Auth.

Ajoute son adresse email dans les variables de build Cloudflare :

```env
VITE_JOURNAL_ADMIN_EMAIL=ton-email@example.com
```

Ce compte doit déjà être présent dans `bestagone_admins`. Le mot de passe n'est jamais écrit dans le code ni dans une variable Vite.

## 4. Déployer

Les variables déjà utilisées par le site restent nécessaires :

```env
VITE_SUPABASE_URL=https://TON_PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TA_CLE
VITE_JOURNAL_PATH=/fragments
VITE_JOURNAL_ADMIN_EMAIL=ton-email@example.com
```

Puis déploie normalement :

```bash
npm install
npm run build
npm run deploy:cloudflare
```

## Fonctionnement

- Lecture : accessible à toute personne connaissant l'URL exacte.
- Édition : bouton `Édition` + mot de passe du compte Supabase autorisé.
- Articles : titre, rubrique libre, accroche, texte, brouillon/publié.
- Mise en forme : `##` intertitre, `>` citation, `-` liste, `**gras**`, `*italique*`, `` `code` ``, `---` séparation.
- URL directe d'un article : la page ajoute `?a=slug`.
- Ambiance : marbre/or sobre par défaut, bouton `Dérive calme` pour renforcer l'animation chromatique.

## Personnalisation rapide

Dans `src/Journal.jsx` :

```js
const DEFAULT_TITLE = 'FRAGMENTS';
```

Change cette valeur pour renommer le carnet.

Le visuel de marbre est dans :

```text
public/fragments-marble.webp
```
