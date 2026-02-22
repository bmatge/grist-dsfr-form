import express from 'express';
import { JSDOM } from 'jsdom';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Domaines Grist autorisés
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'grist.numerique.gouv.fr,docs.getgrist.com')
  .split(',')
  .map(h => h.trim());

// Version DSFR
const DSFR_VERSION = process.env.DSFR_VERSION || '1.14.3';
const DSFR_CSS = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/dsfr/dsfr.min.css`;
const DSFR_ICONS = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/utility/icons/icons.min.css`;
const DSFR_JS_MODULE = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/dsfr/dsfr.module.min.js`;
const DSFR_JS_NOMODULE = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/dsfr/dsfr.nomodule.min.js`;

// Derrière un reverse proxy (Traefik), faire confiance au header X-Forwarded-Proto
app.set('trust proxy', true);

// Servir la CSS override en statique
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Page d'accueil
app.get('/', (req, res) => {
  if (!req.query.url) {
    return res.send(landingPage(req));
  }

  handleProxy(req, res);
});

async function handleProxy(req, res) {
  const formUrl = req.query.url;

  // Validation URL
  let parsed;
  try {
    parsed = new URL(formUrl);
  } catch {
    return res.status(400).send('URL invalide');
  }

  // Whitelist
  if (!ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
    return res.status(403).send(
      `Domaine non autorisé : ${parsed.hostname}. Autorisés : ${ALLOWED_HOSTS.join(', ')}`
    );
  }

  try {
    // Demander du contenu non-compressé pour éviter les problèmes d'encodage
    const response = await fetch(formUrl, {
      headers: {
        'Accept': 'text/html',
        'Accept-Encoding': 'identity',
      },
    });

    if (!response.ok) {
      return res.status(response.status).send(
        `Erreur Grist : ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();

    // Réécriture du HTML avec JSDOM
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Réécrire les URLs relatives pour pointer vers le serveur Grist d'origine
    const gristOrigin = parsed.origin;
    doc.querySelectorAll('script[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && src.startsWith('/')) el.setAttribute('src', gristOrigin + src);
    });
    doc.querySelectorAll('link[href]').forEach(el => {
      const href = el.getAttribute('href');
      if (href && href.startsWith('/')) el.setAttribute('href', gristOrigin + href);
    });
    doc.querySelectorAll('img[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && src.startsWith('/')) el.setAttribute('src', gristOrigin + src);
    });
    doc.querySelectorAll('form[action]').forEach(el => {
      const action = el.getAttribute('action');
      if (action && action.startsWith('/')) el.setAttribute('action', gristOrigin + action);
    });

    // Attributs <html>
    doc.documentElement.setAttribute('lang', 'fr');
    doc.documentElement.setAttribute('data-fr-scheme', 'light');

    // Injection CSS dans <head>
    const overrideCssUrl = `${req.protocol}://${req.get('host')}/static/grist-dsfr-override.css`;
    const head = doc.head;
    head.insertAdjacentHTML('beforeend', `
      <link rel="stylesheet" href="${DSFR_CSS}">
      <link rel="stylesheet" href="${DSFR_ICONS}">
      <link rel="stylesheet" href="${overrideCssUrl}">
      <meta name="theme-color" content="#000091">
    `);

    // Injection JS avant </body>
    const body = doc.body;
    body.insertAdjacentHTML('beforeend', `
      <script type="module" src="${DSFR_JS_MODULE}"></script>
      <script nomodule src="${DSFR_JS_NOMODULE}"></script>
    `);

    // Répondre avec du HTML propre, sans headers d'encodage hérités
    res.removeHeader('Content-Encoding');
    res.removeHeader('Content-Length');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(dom.serialize());
  } catch (e) {
    console.error('Erreur proxy:', e);
    res.status(502).send(`Erreur proxy : ${e.message}`);
  }
}

function landingPage(req) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `<!DOCTYPE html>
<html lang="fr" data-fr-scheme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formulaire Grist en DSFR</title>
  <link rel="stylesheet" href="${DSFR_CSS}">
  <link rel="stylesheet" href="${DSFR_ICONS}">
</head>
<body>
  <div class="fr-container fr-my-4w">
    <h1 class="fr-h2">Formulaire Grist en DSFR</h1>
    <p class="fr-text--lg">
      Ce service applique le style du Système de Design de l'État (DSFR)
      aux formulaires Grist publiés.
    </p>
    <div class="fr-callout fr-my-4w">
      <h2 class="fr-callout__title">Comment utiliser</h2>
      <p class="fr-callout__text">
        Ajoutez l'URL de votre formulaire Grist publié en paramètre :
      </p>
      <code style="display:block;margin-top:1rem;padding:1rem;background:#f6f6f6;border-radius:4px;word-break:break-all;">
        ${baseUrl}/?url=https://grist.numerique.gouv.fr/forms/VOTRE_FORM_ID/1
      </code>
    </div>
    <h2 class="fr-h4 fr-mt-4w">Domaines autorisés</h2>
    <ul class="fr-list">
      ${ALLOWED_HOSTS.map(h => `<li>${h}</li>`).join('\n      ')}
    </ul>
  </div>
  <script type="module" src="${DSFR_JS_MODULE}"></script>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`Serveur DSFR-Grist démarré sur http://localhost:${PORT}`);
});
