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

// Headers de sécurité
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
  next();
});

// Servir la CSS override en statique
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Proxy des assets Grist — sert les fichiers statiques de Grist à travers
// notre serveur pour satisfaire la CSP 'self' de Traefik
app.get('/grist-assets/:gristHost/*', async (req, res) => {
  const { gristHost } = req.params;
  const assetPath = req.params[0];

  if (!isAllowedHost(gristHost)) {
    return res.status(403).send('Domaine non autorisé');
  }

  try {
    const assetUrl = `https://${gristHost}/${assetPath}`;
    const response = await fetch(assetUrl, {
      headers: { 'Accept-Encoding': 'identity' },
    });

    if (!response.ok) {
      return res.status(response.status).send('Asset non trouvé');
    }

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buffer = Buffer.from(await response.arrayBuffer());
    res.write(buffer);
    res.end();
  } catch (e) {
    console.error('Erreur proxy asset:', e);
    res.status(502).send('Erreur proxy asset');
  }
});

// Proxy API Grist — les appels API de form.bundle.js passent par ici
// pour éviter les problèmes CORS (même origin)
app.all('/o/*/api/*', proxyApiToGrist);
app.all('/api/*', proxyApiToGrist);

async function proxyApiToGrist(req, res) {
  const gristHost = req.query.host || ALLOWED_HOSTS[0];

  if (!isAllowedHost(gristHost)) {
    return res.status(403).send('Domaine non autorisé');
  }

  try {
    // Construire l'URL Grist en conservant le path et les query params (sauf host)
    const url = new URL(`https://${gristHost}${req.path}`);
    for (const [key, val] of Object.entries(req.query)) {
      if (key !== 'host') url.searchParams.set(key, val);
    }

    const headers = { 'Accept-Encoding': 'identity' };
    // Transmettre le Content-Type si présent (POST/PUT)
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const fetchOpts = {
      method: req.method,
      headers,
    };

    // Transmettre le body pour POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      fetchOpts.body = Buffer.concat(chunks);
    }

    const response = await fetch(url.toString(), fetchOpts);

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(response.status);

    const buffer = Buffer.from(await response.arrayBuffer());
    res.write(buffer);
    res.end();
  } catch (e) {
    console.error('Erreur proxy API:', e);
    res.status(502).send('Erreur proxy API');
  }
}

// Page d'accueil — avec ?url= on redirige vers le bon chemin
app.get('/', (req, res) => {
  if (!req.query.url) {
    return res.send(landingPage(req));
  }

  // Rediriger /?url=https://grist.host/o/org/forms/id/n
  // vers /o/org/forms/id/n?host=grist.host
  let parsed;
  try {
    parsed = new URL(req.query.url);
  } catch {
    return res.status(400).send('URL invalide');
  }

  if (!isAllowedHost(parsed.hostname)) {
    return res.status(403).send(
      `Domaine non autorisé : ${parsed.hostname}. Autorisés : ${ALLOWED_HOSTS.join(', ')}`
    );
  }

  const targetPath = parsed.pathname + `?host=${encodeURIComponent(parsed.hostname)}`;
  res.redirect(targetPath);
});

// Route principale : proxy du formulaire Grist au même chemin
// Grist utilise window.location.pathname pour parser l'URL state
app.get('/o/*/forms/*', handleFormProxy);
app.get('/forms/*', handleFormProxy);

async function handleFormProxy(req, res) {
  const gristHost = req.query.host || ALLOWED_HOSTS[0];

  if (!isAllowedHost(gristHost)) {
    return res.status(403).send('Domaine non autorisé');
  }

  const formUrl = `https://${gristHost}${req.path}`;
  const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;

  try {
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

    // Réécrire <base href> pour pointer vers notre proxy d'assets (même origin → CSP OK)
    // Cela résout automatiquement TOUS les chemins relatifs (scripts, CSS, locales, images)
    const baseEl = doc.querySelector('base[href]');
    const originalBase = baseEl ? baseEl.getAttribute('href') : '/';
    const proxyBase = `/grist-assets/${gristHost}/${originalBase.replace(/^\/+/, '')}`;
    if (baseEl) {
      baseEl.setAttribute('href', proxyBase);
    } else {
      doc.head.insertAdjacentHTML('afterbegin', `<base href="${proxyBase}">`);
    }

    // Modifier gristConfig pour que les appels API passent par notre proxy
    doc.querySelectorAll('script').forEach(script => {
      const text = script.textContent;
      if (text && text.includes('window.gristConfig')) {
        // Réécrire homeUrl vers notre proxy et activer serveSameOrigin
        let modified = text.replace(
          /"homeUrl"\s*:\s*"[^"]+"/,
          `"homeUrl":"${proxyBaseUrl}/"`
        );
        modified = modified.replace(
          /"serveSameOrigin"\s*:\s*false/,
          '"serveSameOrigin":true'
        );
        script.textContent = modified;
      }
    });

    // Attributs <html>
    doc.documentElement.setAttribute('lang', 'fr');
    doc.documentElement.setAttribute('data-fr-scheme', 'light');
    doc.documentElement.setAttribute('data-grist-form', '');

    // Injection CSS dans <head>
    doc.head.insertAdjacentHTML('beforeend', `
      <link rel="stylesheet" href="${DSFR_CSS}">
      <link rel="stylesheet" href="${DSFR_ICONS}">
      <link rel="stylesheet" href="${proxyBaseUrl}/static/grist-dsfr-override.css">
      <meta name="theme-color" content="#000091">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    `);

    // Extraire le titre du formulaire depuis le gristConfig ou le <title>
    const titleEl = doc.querySelector('title');
    const formTitle = titleEl ? titleEl.textContent.replace(' - Grist', '').replace('Grist Form', 'Formulaire').trim() : 'Formulaire';

    // Injecter le header DSFR au début du body (avant les scripts Grist)
    doc.body.insertAdjacentHTML('afterbegin', `
      <header role="banner" class="fr-header" id="dsfr-header">
        <div class="fr-header__body">
          <div class="fr-container">
            <div class="fr-header__body-row">
              <div class="fr-header__brand fr-enlarge-link">
                <div class="fr-header__brand-top">
                  <div class="fr-header__logo">
                    <p class="fr-logo">République<br>Française</p>
                  </div>
                </div>
                <div class="fr-header__service">
                  <a href="/" title="Accueil">
                    <p class="fr-header__service-title">${formTitle}</p>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    `);

    // Injecter le footer DSFR et le JS à la fin du body
    doc.body.insertAdjacentHTML('beforeend', `
      <footer class="fr-footer" role="contentinfo" id="dsfr-footer">
        <div class="fr-container">
          <div class="fr-footer__body">
            <div class="fr-footer__brand fr-enlarge-link">
              <p class="fr-logo">République<br>Française</p>
            </div>
            <div class="fr-footer__content">
              <p class="fr-footer__content-desc">
                Formulaire propulsé par <a href="https://www.getgrist.com" target="_blank" rel="noopener">Grist</a>
                — Style DSFR appliqué par le proxy
              </p>
            </div>
          </div>
          <div class="fr-footer__bottom">
            <ul class="fr-footer__bottom-list">
              <li class="fr-footer__bottom-item">
                <a class="fr-footer__bottom-link" href="https://www.getgrist.com/forms/" target="_blank" rel="noopener">Grist Forms</a>
              </li>
              <li class="fr-footer__bottom-item">
                <a class="fr-footer__bottom-link" href="https://www.systeme-de-design.gouv.fr/" target="_blank" rel="noopener">DSFR</a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
      <script type="module" src="${DSFR_JS_MODULE}"></script>
      <script nomodule src="${DSFR_JS_NOMODULE}"></script>
      <script src="${proxyBaseUrl}/static/dsfr-transform.js" defer></script>
    `);

    const output = dom.serialize();
    res.removeHeader('Content-Encoding');
    res.removeHeader('Content-Length');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(output);
    res.end();
  } catch (e) {
    console.error('Erreur proxy:', e);
    res.status(502).send(`Erreur proxy : ${e.message}`);
  }
}

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(host => hostname === host || hostname.endsWith('.' + host));
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
