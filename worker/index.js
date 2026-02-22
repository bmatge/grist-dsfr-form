/**
 * Cloudflare Worker — Proxy DSFR pour formulaires Grist
 *
 * Ce worker récupère un formulaire Grist publié et injecte le thème DSFR
 * (CSS + JS) tout en préservant toutes les fonctionnalités natives.
 *
 * Usage : GET /?url=https://grist.numerique.gouv.fr/forms/xxx/4
 */

// Domaines Grist autorisés (whitelist de sécurité)
const ALLOWED_HOSTS = [
  'grist.numerique.gouv.fr',
  'docs.getgrist.com',
  'grist.incubateur.net',
];

// Version DSFR à injecter
const DSFR_VERSION = '1.14.3';
const DSFR_CSS = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/dsfr/dsfr.min.css`;
const DSFR_ICONS = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/utility/icons/icons.min.css`;
const DSFR_JS_MODULE = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/dsfr/dsfr.module.min.js`;
const DSFR_JS_NOMODULE = `https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@${DSFR_VERSION}/dist/dsfr/dsfr.nomodule.min.js`;

// URL de la CSS override (hébergée sur GitHub Pages)
// À ajuster selon le déploiement réel
const OVERRIDE_CSS = 'https://bmatge.github.io/grist-dsfr-form/grist-dsfr-override.css';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Page d'accueil / documentation
    if (!url.searchParams.has('url')) {
      return new Response(landingPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const formUrl = url.searchParams.get('url');

    // Validation de l'URL
    let parsedUrl;
    try {
      parsedUrl = new URL(formUrl);
    } catch {
      return new Response('URL invalide', { status: 400 });
    }

    // Vérification whitelist
    if (!ALLOWED_HOSTS.some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host))) {
      return new Response(
        `Domaine non autorisé : ${parsedUrl.hostname}. Domaines autorisés : ${ALLOWED_HOSTS.join(', ')}`,
        { status: 403 }
      );
    }

    try {
      // Récupérer le formulaire Grist
      const gristResponse = await fetch(formUrl, {
        headers: {
          'User-Agent': 'GristDSFR-Proxy/1.0',
          'Accept': 'text/html',
        },
      });

      if (!gristResponse.ok) {
        return new Response(
          `Erreur lors de la récupération du formulaire : ${gristResponse.status} ${gristResponse.statusText}`,
          { status: gristResponse.status }
        );
      }

      // Utiliser HTMLRewriter pour injecter les ressources DSFR
      const rewriter = new HTMLRewriter()
        .on('head', new HeadInjector())
        .on('body', new BodyInjector())
        .on('html', new HtmlAttributeInjector());

      const response = rewriter.transform(gristResponse);

      // Copier les headers et ajuster
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      // Supprimer les headers de sécurité qui bloqueraient nos injections
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('X-Frame-Options');

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    } catch (e) {
      return new Response(`Erreur proxy : ${e.message}`, { status: 502 });
    }
  },
};

/**
 * Injecte les CSS DSFR dans <head>
 */
class HeadInjector {
  element(element) {
    element.append(
      `
      <!-- DSFR Theme -->
      <link rel="stylesheet" href="${DSFR_CSS}">
      <link rel="stylesheet" href="${DSFR_ICONS}">
      <link rel="stylesheet" href="${OVERRIDE_CSS}">
      <meta name="theme-color" content="#000091">
      `,
      { html: true }
    );
  }
}

/**
 * Injecte le JS DSFR avant </body>
 */
class BodyInjector {
  element(element) {
    element.append(
      `
      <!-- DSFR JS -->
      <script type="module" src="${DSFR_JS_MODULE}"></script>
      <script nomodule src="${DSFR_JS_NOMODULE}"></script>
      `,
      { html: true }
    );
  }
}

/**
 * Ajoute l'attribut lang="fr" et data-fr-scheme à <html>
 */
class HtmlAttributeInjector {
  element(element) {
    element.setAttribute('lang', 'fr');
    element.setAttribute('data-fr-scheme', 'light');
  }
}

/**
 * Page d'accueil du proxy
 */
function landingPage() {
  return `<!DOCTYPE html>
<html lang="fr" data-fr-scheme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proxy DSFR pour Grist</title>
  <link rel="stylesheet" href="${DSFR_CSS}">
  <link rel="stylesheet" href="${DSFR_ICONS}">
</head>
<body>
  <div class="fr-container fr-my-4w">
    <h1 class="fr-h2">Formulaire Grist en DSFR</h1>
    <p class="fr-text--lg">
      Ce service applique le style du Syst\u00e8me de Design de l'\u00c9tat (DSFR)
      aux formulaires Grist publi\u00e9s.
    </p>

    <div class="fr-callout fr-my-4w">
      <h2 class="fr-callout__title">Comment utiliser</h2>
      <p class="fr-callout__text">
        Ajoutez l'URL de votre formulaire Grist publi\u00e9 en param\u00e8tre :
      </p>
      <code class="fr-text--sm" style="display:block; margin-top:1rem; padding:1rem; background:#f6f6f6; border-radius:4px; word-break:break-all;">
        ${'{URL_DU_WORKER}'}/?url=https://grist.numerique.gouv.fr/forms/VOTRE_FORM_ID/1
      </code>
    </div>

    <div class="fr-callout fr-callout--brown-caramel fr-my-4w">
      <h2 class="fr-callout__title">Pr\u00e9requis</h2>
      <p class="fr-callout__text">
        Le formulaire Grist doit \u00eatre publi\u00e9 (bouton "Publish" dans l'\u00e9diteur de formulaire Grist).
        Le document doit avoir l'acc\u00e8s public activ\u00e9 si n\u00e9cessaire.
      </p>
    </div>

    <h2 class="fr-h4 fr-mt-4w">Domaines autoris\u00e9s</h2>
    <ul class="fr-list">
      ${ALLOWED_HOSTS.map(h => `<li>${h}</li>`).join('\n      ')}
    </ul>
  </div>

  <script type="module" src="${DSFR_JS_MODULE}"></script>
  <script nomodule src="${DSFR_JS_NOMODULE}"></script>
</body>
</html>`;
}
