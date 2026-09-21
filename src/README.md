# Patch plein écran — Archives

Ce patch ajoute l'ouverture plein écran des images dans la page Archives.

## Fichiers à placer dans `src/`

- `main.jsx` : remplace celui du patch ART précédent.
- `ImageLightbox.jsx` : nouveau composant réutilisable.
- `image-lightbox.css` : styles du plein écran.

Aucune modification Supabase n'est nécessaire.

## Comportement

- clic sur l'image d'une carte des Archives -> plein écran ;
- image affichée sans découpe hexagonale, avec son ratio d'origine ;
- fermeture par le bouton `×`, clic sur le fond noir ou touche `Échap` ;
- le mode édition et la suppression restent inchangés.
