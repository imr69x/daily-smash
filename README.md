# Daily Smash — site vitrine + administration

Site du snack **Daily Smash** (3 rue de Lyon, Montmerle-sur-Saône). Projet Node/Express classique, pensé pour être ouvert et modifié dans VS Code avec Claude Code.

## Démarrer le projet

```bash
npm install
npm start
```

Le site est alors sur **http://localhost:3000**.

Dans VS Code : ouvrez ce dossier, puis utilisez l'onglet *Run and Debug* → **"Lancer Daily Smash (server.js)"** pour démarrer avec le débogueur attaché (relance automatique si vous éditez le code grâce à `restart: true`).

## Structure du projet

```
daily-smash-site/
├─ server.js            # serveur Express : sert le site + API JSON + API admin protégée
├─ data/menu.json        # "base de données" : tous les produits + réglages du site
├─ public/
│  ├─ index.html          # page publique (aucun code admin dedans)
│  ├─ css/style.css, admin.css
│  ├─ js/app.js            # site public, curseur burger, raccourci admin
│  ├─ js/admin.js          # administration, chargée seulement après Maj+I+B
│  ├─ assets/logo.jpg
│  ├─ assets/hero-burger.jpg
│  └─ uploads/             # images ajoutées depuis l'administration (généré au runtime)
├─ .env                   # identifiants admin (ne jamais committer — déjà dans .gitignore)
└─ .env.example           # modèle à copier
```

## Administration

- Sur le site, pressez **Shift + I + B** (hors d'un champ de texte) pour ouvrir la fenêtre d'administration.
- Connectez-vous avec l'identifiant/mot de passe du fichier `.env` (`ADMIN_USER` / `ADMIN_PASSWORD`).
- Un mot de passe aléatoire a été généré automatiquement dans `.env` à la création du projet. **Changez-le** avant toute mise en ligne — éditez simplement `ADMIN_PASSWORD` dans `.env` puis relancez le serveur.
- Depuis le panneau : gérer les produits (onglet « Autres produits » : filtre Tout / par catégorie), ajouter des burgers signature (les 3 de base sont protégés), gérer le ou les burgers du moment (section dédiée en haut de page, incluse dans le diaporama d'accueil) (section automatiquement masquée côté client si aucun n'est actif, et le texte s'accorde seul au singulier/pluriel), configurer un bandeau défilant, activer/choisir un curseur en forme de burger, modifier les infos pratiques (adresse, horaires, téléphone, réseaux).

### Ce qui protège réellement l'administration

- **Côté serveur uniquement** : chaque écriture (`POST`/`PATCH`/`DELETE` sur `/api/admin/...`) exige un identifiant/mot de passe HTTP Basic vérifiés dans `server.js`. Le raccourci clavier n'est qu'un confort d'interface — il n'autorise rien par lui-même.
- **Limites actuelles**, à corriger avant une mise en ligne publique sérieuse :
  - Le mot de passe est en clair dans `.env` et comparé en clair (pas de hachage) — correct pour un usage interne à une poignée de personnes, pas pour un vrai compte multi-utilisateur.
  - Pas de HTTPS intégré : si vous déployez ce serveur sur Internet, mettez-le derrière un reverse proxy (Nginx, Caddy) ou une plateforme qui fournit le HTTPS.
  - Blocage de 10 min après 8 échecs de connexion par IP (en mémoire, remis à zéro au redémarrage).
  - Si plusieurs personnes doivent avoir des accès différents (ex. un gérant qui peut tout faire, un employé qui ne gère que le bandeau), il faudra remplacer l'auth Basic partagée par de vrais comptes utilisateurs.

## Stockage des données

- `data/menu.json` est la source de vérité pour le menu et les réglages. Le serveur la lit/écrit directement (écriture atomique via fichier temporaire + renommage).
- C'est volontairement simple : parfait pour un seul snack avec peu de modifications par jour. **Ce n'est pas une vraie base de données** : pas de transactions, pas de verrouillage fin entre écritures concurrentes (une file d'attente basique sérialise les écritures côté serveur, donc deux admins en même temps ne corrompent pas le fichier, mais la dernière écriture gagne). Si le site grossit (plusieurs établissements, forte fréquence de mise à jour, besoin d'historique), migrez vers SQLite ou Postgres.
- Les images uploadées depuis l'admin sont stockées dans `public/uploads/` et référencées par leur chemin dans `data/menu.json`.

## Photos

Uber Eats protège sa page par un contrôle anti-robot : les photos n'ont pas pu être récupérées automatiquement. Ajoutez-les depuis l'admin (onglets *Burgers signature* → Modifier → Photo) ; l'admin avertit si l'image fait moins de 800 px de large.


Une seule photo existait réellement sur la page Uber Eats du restaurant (`public/assets/hero-burger.jpg`, 550×550 — c'est la résolution maximale disponible côté Uber Eats, il n'existe pas de version plus grande à récupérer). Elle est utilisée en image d'accroche, sans être attribuée à un burger précis puisque Uber Eats la réutilisait pour plusieurs produits différents. Ajoutez vos propres photos par produit depuis le panneau admin (champ "Image") dès que vous les avez.

## Déploiement

Ce projet tourne tel quel sur n'importe quel hébergeur Node (Render, Railway, VPS, etc.). Pensez à :
1. définir `ADMIN_PASSWORD` dans les variables d'environnement de l'hébergeur (jamais dans le code) ;
2. servir le site en HTTPS ;
3. sauvegarder régulièrement `data/menu.json` et le dossier `public/uploads/` (ce sont les seules données qui ne sont pas dans le code).

## Publication en ligne (GitHub Pages)

Version statique, sans administration : `npm run build:static` génère le dossier `docs/` (menu lu depuis `docs/menu.json`), publié par GitHub Pages. Le raccourci Maj+I+B affiche seulement un message d'indisponibilité.

Pour mettre à jour le site en ligne après avoir changé le menu en local (via l'admin ou `data/menu.json`) :

```bash
npm run build:static
git add -A && git commit -m "Mise à jour du menu" && git push
```

L'administration complète (modification en ligne) demande un hébergeur Node avec disque persistant ; GitHub Pages ne peut pas l'exécuter.
