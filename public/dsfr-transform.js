/**
 * DSFR Transform — Transforme le formulaire Grist natif en composants DSFR
 *
 * Navigue le DOM depuis le <form> vers le haut pour trouver et masquer
 * le chrome Grist (cadre, barre titre, footer), sans dépendre de data-testid.
 */
(function () {
  'use strict';

  // ── Attente du rendu du formulaire ──────────────────────────────

  function waitForForm() {
    return new Promise((resolve) => {
      const form = document.querySelector('form');
      if (form) return resolve(form);

      const observer = new MutationObserver(() => {
        const f = document.querySelector('form');
        if (f) {
          observer.disconnect();
          resolve(f);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, 10000);
    });
  }

  // ── Utilitaire ──────────────────────────────────────────────────

  function setImportant(el, props) {
    for (const [prop, val] of Object.entries(props)) {
      el.style.setProperty(prop, val, 'important');
    }
  }

  // ── Navigation structurelle depuis <form> ───────────────────────
  //
  // Hiérarchie DOM Grist attendue :
  //   body
  //     header.fr-header        (injecté par le proxy)
  //     div (React root)
  //       div
  //         div
  //           div (framing)     ← bordure bleue + ombre
  //             div (titleBar)  ← "Grist Form (?)"
  //             div (content)
  //               main
  //                 form
  //           div (gristFooter) ← "Powered by Grist"
  //     footer.fr-footer        (injecté par le proxy)

  function findFramingElements(form) {
    const main = form.closest('main') || form.parentElement;
    if (!main) return null;

    // contentWrapper = parent de <main>
    const contentWrapper = main.parentElement;
    if (!contentWrapper) return null;

    // framing = parent de contentWrapper (le div avec la bordure bleue)
    const framing = contentWrapper.parentElement;
    if (!framing || framing === document.body) return null;

    // titleBar = les enfants du framing qui ne sont PAS le contentWrapper
    const titleBars = [];
    for (const child of framing.children) {
      if (child !== contentWrapper) {
        titleBars.push(child);
      }
    }

    // gristFooter = frère du framing qui contient un lien getgrist.com
    // ou qui n'est pas le framing et ne contient pas de formulaire
    let gristFooter = null;
    if (framing.parentElement) {
      for (const sibling of framing.parentElement.children) {
        if (sibling === framing) continue;
        if (sibling.classList.contains('fr-header') || sibling.classList.contains('fr-footer')) continue;
        if (sibling.tagName === 'HEADER' || sibling.tagName === 'FOOTER') continue;
        if (sibling.tagName === 'SCRIPT') continue;
        // Ce div est le footer Grist
        gristFooter = sibling;
      }
    }

    return { main, contentWrapper, framing, titleBars, gristFooter };
  }

  // ── Masquer le chrome Grist ─────────────────────────────────────

  function hideGristChrome(elems) {
    if (!elems) return;

    // 1. Framing : supprimer bordure, ombre, arrondis
    setImportant(elems.framing, {
      border: 'none',
      'border-top': 'none',
      'border-radius': '0',
      'box-shadow': 'none',
      background: 'transparent',
      'max-width': '100%',
      width: '100%',
      margin: '0',
      padding: '0',
    });

    // 2. Barre titre "Grist Form" — masquer
    for (const bar of elems.titleBars) {
      setImportant(bar, { display: 'none' });
    }

    // 3. Footer Grist "Powered by Grist" — masquer
    if (elems.gristFooter) {
      setImportant(elems.gristFooter, { display: 'none' });
    }

    // Fallback : chercher aussi par data-testid si présent
    const ftid = document.querySelector('[data-testid="test-form-framing"]');
    if (ftid && ftid !== elems.framing) {
      setImportant(ftid, {
        border: 'none', 'border-top': 'none', 'border-radius': '0',
        'box-shadow': 'none', background: 'transparent',
        'max-width': '100%', width: '100%', margin: '0', padding: '0',
      });
    }
    const ptid = document.querySelector('[data-testid="test-form-page"]');
    if (ptid) setImportant(ptid, { display: 'none' });
  }

  // ── Layout : supprimer les contraintes de scroll interne ────────

  function fixLayout(form, elems) {
    // Remonter depuis le form jusqu'au body, libérer height/overflow
    let el = form;
    while (el && el !== document.body) {
      // Ne pas toucher au header/footer DSFR
      if (el.classList.contains('fr-header') || el.classList.contains('fr-footer')) {
        el = el.parentElement;
        continue;
      }
      setImportant(el, {
        height: 'auto',
        'min-height': '0',
        'max-height': 'none',
        overflow: 'visible',
      });
      el = el.parentElement;
    }

    // Le React root (premier div enfant du body qui n'est pas header/footer)
    for (const child of document.body.children) {
      if (child.tagName === 'HEADER' || child.tagName === 'FOOTER') continue;
      if (child.classList.contains('fr-header') || child.classList.contains('fr-footer')) continue;
      if (child.tagName === 'SCRIPT') continue;
      // C'est le React root
      setImportant(child, {
        flex: '1',
        height: 'auto',
        'min-height': '0',
        'max-height': 'none',
        overflow: 'visible',
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
      });

      // Descendre dans les divs intermédiaires
      let inner = child;
      for (let i = 0; i < 10 && inner; i++) {
        if (inner.tagName === 'MAIN' || inner.tagName === 'FORM') break;
        setImportant(inner, {
          height: 'auto',
          'min-height': '0',
          'max-height': 'none',
          overflow: 'visible',
          width: '100%',
        });
        // Suivre le premier enfant div
        const nextDiv = inner.querySelector(':scope > div');
        if (!nextDiv) break;
        inner = nextDiv;
      }
      break; // Un seul React root
    }
  }

  // ── Ajout des classes DSFR ──────────────────────────────────────

  function addDsfrClasses(form) {
    // Inputs texte
    form.querySelectorAll([
      'input[type="text"]', 'input[type="number"]', 'input[type="email"]',
      'input[type="tel"]', 'input[type="url"]', 'input[type="password"]',
      'input[type="date"]', 'input[type="datetime-local"]', 'input[type="time"]',
    ].join(',')).forEach(el => el.classList.add('fr-input'));

    // Textareas
    form.querySelectorAll('textarea').forEach(el => el.classList.add('fr-input'));

    // Selects
    form.querySelectorAll('select').forEach(el => el.classList.add('fr-select'));

    // Labels principaux (pas ceux qui wrappent un radio/checkbox)
    form.querySelectorAll('label').forEach(label => {
      if (!label.querySelector('input[type="radio"], input[type="checkbox"]')) {
        label.classList.add('fr-label');
      }
    });

    // Bouton de soumission
    form.querySelectorAll('button[type="submit"]').forEach(btn => {
      btn.classList.add('fr-btn');
    });

    // Boutons secondaires
    form.querySelectorAll('button[type="button"]').forEach(btn => {
      if (!btn.classList.contains('fr-btn')) {
        btn.classList.add('fr-btn', 'fr-btn--secondary');
      }
    });

    // Upload de fichiers
    form.querySelectorAll('input[type="file"]').forEach(el => {
      el.classList.add('fr-upload');
    });
  }

  // ── Observer les changements dynamiques ─────────────────────────

  function observeChanges(form, elems) {
    let debounce;
    const observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const currentForm = document.querySelector('form');
        if (currentForm) addDsfrClasses(currentForm);
        hideGristChrome(elems);
      }, 150);
    });

    const root = elems ? (elems.framing.parentElement || document.body) : document.body;
    observer.observe(root, { childList: true, subtree: true });
  }

  // ── Point d'entrée ──────────────────────────────────────────────

  async function main() {
    console.log('[DSFR] Attente du formulaire…');
    const form = await waitForForm();
    if (!form) {
      console.warn('[DSFR] Formulaire non trouvé après 10s');
      return;
    }

    console.log('[DSFR] Formulaire détecté, transformation…');
    const elems = findFramingElements(form);
    console.log('[DSFR] Éléments trouvés:', {
      framing: !!elems?.framing,
      titleBars: elems?.titleBars?.length,
      gristFooter: !!elems?.gristFooter,
    });

    fixLayout(form, elems);
    hideGristChrome(elems);
    addDsfrClasses(form);
    observeChanges(form, elems);

    document.documentElement.setAttribute('data-dsfr-ready', 'true');
    console.log('[DSFR] Transformation terminée');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
