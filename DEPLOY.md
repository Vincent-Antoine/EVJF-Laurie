# Mise en ligne (gratuit, simple)

Ce projet est une **app statique** (Vite + React) : le build produit le dossier `dist/`, à servir tel quel.

## Prérequis

- Compte **GitHub** (gratuit) pour héberger le code.
- Choisir **une** plateforme ci-dessous (toutes ont un plan gratuit suffisant pour ce site).

---

## Option A — Vercel (très rapide)

1. Va sur [vercel.com](https://vercel.com) et connecte ton compte GitHub.
2. **Add New Project** → importe le dépôt de ce projet.
3. Laisse la détection **Vite** : build `npm run build`, dossier de sortie `dist` (déjà indiqué dans `vercel.json` si besoin).
4. **Deploy**.

Domaine fourni du type `xxx.vercel.app`. Tu peux ajouter ton **sous-domaine** dans **Project → Settings → Domains** (voir section Domaine personnalisé plus bas).

---

## Option B — Netlify

1. Va sur [netlify.com](https://www.netlify.com) et connecte GitHub.
2. **Add new site** → import du dépôt.
3. Build : `npm run build`, publish : `dist` (déjà dans `netlify.toml`).
4. **Deploy**.

---

## Option C — Cloudflare Pages

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → connecte le dépôt Git.
2. Build : `npm run build`, output : `dist`.
3. Le fichier `public/_redirects` est copié dans `dist` pour le routage SPA.

---

## Domaine personnalisé (sous-domaine chez toi)

1. Sur la plateforme choisie, ouvre **Domains** / **Custom domains** et ajoute par ex. `evjf.tondomaine.fr`.
2. Chez ton **registrar / DNS** (là où est ton nom de domaine), ajoute l’enregistrement demandé, en général :
   - **CNAME** : `evjf` (ou `@` pour la racine selon les cas) → la cible indiquée par Vercel / Netlify / Cloudflare (souvent `cname.vercel-dns.com`, `xxx.netlify.app`, ou un sous-domaine Cloudflare).
3. Attends la propagation DNS (souvent quelques minutes à quelques heures).

Les trois services gèrent le **HTTPS** (certificat Let’s Encrypt) automatiquement.

---

## Variables d’environnement (optionnel)

Pour remplacer la liste des 3 e-mails de réception des résultats, sur le tableau de bord de l’hébergeur ajoute :

- `VITE_RESULT_EMAIL` = `mail1@x.com,mail2@x.com`

Puis **redéploie** (les variables `VITE_*` sont injectées au moment du build).

---

## Vérifier en local avant déploiement

```bash
npm install
npm run build
npm run preview
```

Ouvre l’URL affichée (souvent `http://localhost:4173`) pour tester la version production.
