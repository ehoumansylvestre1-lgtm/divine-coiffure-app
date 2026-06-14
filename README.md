# Guide d'installation — Appli tablette Divine Coiffure

## Ce que c'est

Un fichier HTML qui s'ouvre dans n'importe quel navigateur sur une tablette.
- Fonctionne SANS connexion internet
- Sauvegarde les données sur la tablette
- Synchronise vers Google Sheets quand le WiFi est disponible

---

## Installation en 3 étapes

### ÉTAPE 1 — Copier les fichiers sur la tablette

Copiez le dossier `app/` entier sur la tablette (clé USB, email, Google Drive, peu importe).

Le dossier contient :
- `index.html` ← le fichier à ouvrir
- `style.css`
- `app.js`

### ÉTAPE 2 — Configurer Google Sheets (fait une seule fois par Sylvestre)

1. Créer un nouveau Google Sheets (sheets.google.com)
2. Copier l'ID du fichier depuis l'URL (la longue suite de lettres entre `/d/` et `/edit`)
3. Aller sur script.google.com → Nouveau projet
4. Coller le contenu de `Automatisation/google_sheets_script.js`
5. Remplacer `COLLER_ICI_ID_GOOGLE_SHEETS` par l'ID copié à l'étape 2
6. Cliquer "Déployer" → "Nouvelle application web"
   - Exécuter en tant que : Moi
   - Accès : Tout le monde
7. Copier l'URL générée (ex: `https://script.google.com/macros/s/AKfycb.../exec`)

### ÉTAPE 3 — Relier l'appli à Google Sheets

Dans le fichier `app/app.js`, ligne 4 :
```
const GOOGLE_SCRIPT_URL = 'COLLER_ICI_URL_APPS_SCRIPT';
```
Remplacer `COLLER_ICI_URL_APPS_SCRIPT` par l'URL copiée à l'étape 6.

---

## Utilisation quotidienne

Ouvrir `index.html` dans Chrome sur la tablette. C'est tout.

Pour mettre en raccourci sur l'écran d'accueil (Android) :
- Ouvrir Chrome → Menu (3 points) → "Ajouter à l'écran d'accueil"

---

## Questions fréquentes

**Les données sont-elles perdues si la tablette s'éteint ?**
Non. Elles sont sauvegardées dans la mémoire du navigateur (localStorage). Elles persistent même après extinction.

**Que se passe-t-il si on change de tablette ?**
Il faut exporter le CSV depuis l'ancienne tablette (bouton "Exporter") avant de changer. Si la sync Google Sheets était configurée, tout est déjà dans Google Sheets.

**On peut utiliser sur un téléphone ?**
Oui. L'interface s'adapte. Mais une tablette est plus confortable.
