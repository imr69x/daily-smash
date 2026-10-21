# Daily Smash — contexte pour Claude Code

Site du snack Daily Smash (Montmerle-sur-Saône). Projet Node/Express classique (pas de framework front, pas de build step).

## État actuel

- `npm install` puis `npm start` lance le site sur http://localhost:3000.
- Le menu et les réglages du site sont dans `data/menu.json` (lu/écrit par `server.js`, pas de vraie base de données).
- La page publique (`public/index.html` + `public/js/app.js` + `public/css/style.css`) affiche le menu depuis `/api/menu`.
- Un panneau d'administration caché s'ouvre avec le raccourci clavier **Shift + I + B** sur le site. Il doit permettre d'ajouter/modifier/supprimer des produits, gérer le "burger du moment", un bandeau défilant, un curseur personnalisé, et les infos pratiques (adresse, horaires, téléphone, réseaux).
- L'admin est censé se connecter avec l'identifiant/mot de passe du fichier `.env` (`ADMIN_USER` / `ADMIN_PASSWORD`), vérifiés côté serveur dans `server.js` (routes `/api/admin/*`).

## Bug 401 (résolu)

Cause réelle : `renderAdmin` plantait quand il n'y avait aucun burger du moment (un `<p class="empty-note">` était traité comme un produit). L'exception était attrapée par le `catch` du login, qui effaçait les identifiants alors que le panneau était déjà affiché → toutes les actions suivantes partaient sans `Authorization`. L'admin a été réécrit (`public/js/admin.js`, chargé à la demande) : le jeton n'est effacé que par un vrai 401 serveur ou par « Se déconnecter ».

## Structure actuelle

- `public/js/app.js` : site public, curseur burger, raccourci Maj+I+B (charge `admin.js` + `admin.css` à la demande), expose `window.DS`.
- `public/js/admin.js` + `public/css/admin.css` : overlay d'administration (produits, burgers du moment, bandeau, curseur, infos + réseaux sociaux avec logos).
- Réseaux : `settings.socials[]` (`platform`, `label`, `url`), logos SVG dans `PLATFORMS` (app.js). Les 3 burgers `signature` ne peuvent être ni supprimés ni masqués (imposé par le serveur).
- Sans `ADMIN_PASSWORD` dans `.env`, l'admin est désactivée (503).

## Autres infos

- Les vraies données du menu (prix, compositions) viennent d'une photo des écrans du snack, pas d'une source inventée — ne pas les modifier sans vérifier avec le restaurateur.
- Une seule vraie photo du resto existe pour l'instant (`public/assets/hero-burger.jpg`), récupérée depuis Uber Eats en 550×550 (pas de version plus grande disponible). Les autres produits n'ont pas encore d'image.
- Détails complets (structure, déploiement, limites de sécurité) dans `README.md`.
