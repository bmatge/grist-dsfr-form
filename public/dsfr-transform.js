/**
 * DSFR Transform — Transforme le formulaire Grist natif en composants DSFR
 *
 * Ce script attend que form.bundle.js rende le formulaire, puis :
 * 1. Supprime les contraintes de scroll internes (page autonome)
 * 2. Masque le chrome Grist (cadre bleu, barre titre, footer "Powered by")
 * 3. Ajoute les classes DSFR aux éléments du formulaire
 * 4. Observe les changements dynamiques (validation, page de succès)
 *
 * Les liaisons React sont préservées : on ajoute des classes et des styles
 * inline sans déplacer ni supprimer de nœuds DOM gérés par React.
 */
(function () {
  'use strict';

  // ── Attente du rendu du formulaire ──────────────────────────────

  function waitForForm() {
    return new Promise((resolve) => {
      const form = document.querySelector('form');
      if (form) return resolve(form);

      const observer = new MutationObserver(() => {
        const form = document.querySelector('form');
        if (form) {
          observer.disconnect();
          resolve(form);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(document.querySelector('form'));
      }, 10000);
    });
  }

  // ── Layout : supprimer les contraintes de scroll interne ────────

  function fixLayout() {
    // Grist rend le formulaire dans un conteneur full-viewport avec son
    // propre scroll. On libère tous les ancêtres pour que le scroll
    // soit celui du document (la page paraît "autonome").
    const reactRoot = document.body.querySelector(':scope > div');
    if (!reactRoot) return;

    // Remonter du React root jusqu'au body
    let el = reactRoot;
    while (el && el !== document.body) {
      setImportant(el, {
        height: 'auto',
        'min-height': '0',
        'max-height': 'none',
        overflow: 'visible',
      });
      el = el.parentElement;
    }

    // Descendre dans l'arbre React (divs imbriqués)
    el = reactRoot;
    for (let i = 0; i < 10 && el; i++) {
      setImportant(el, {
        height: 'auto',
        'min-height': '0',
        'max-height': 'none',
        overflow: 'visible',
      });
      if (el.tagName === 'FORM' || el.tagName === 'MAIN') break;
      el = el.firstElementChild;
    }
  }

  // ── Masquer le chrome Grist ─────────────────────────────────────

  function hideGristChrome() {
    // 1. Conteneur de framing (bordure colorée + ombre)
    const framing = document.querySelector('[data-testid="test-form-framing"]');
    if (framing) {
      setImportant(framing, {
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

      // 2. Barre titre "Grist Form" — premier enfant qui ne contient pas le <main>
      for (const child of framing.children) {
        if (!child.querySelector('main, form')) {
          child.style.setProperty('display', 'none', 'important');
        }
      }
    }

    // 3. Footer Grist "Powered by Grist"
    const gristFooter = document.querySelector('[data-testid="test-form-page"]');
    if (gristFooter) {
      gristFooter.style.setProperty('display', 'none', 'important');
    }

    // Aussi masquer tout autre footer Grist résiduel
    document.querySelectorAll('a[href*="getgrist.com"]').forEach(link => {
      const container = link.closest('div');
      if (container && !container.querySelector('input, select, textarea, form')
          && !container.classList.contains('fr-footer__content')) {
        container.style.setProperty('display', 'none', 'important');
      }
    });
  }

  // ── Ajout des classes DSFR ──────────────────────────────────────

  function addDsfrClasses(form) {
    // Inputs texte / nombre / date / email / etc.
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

    // Wrapper les "questions" (divs enfants du form contenant label + input)
    classifyQuestions(form);
  }

  function classifyQuestions(form) {
    // Chaque enfant direct du <form> qui contient un champ est une "question"
    for (const div of form.children) {
      if (div.tagName !== 'DIV') continue;
      // Ne pas re-classifier si déjà fait
      if (div.classList.contains('fr-input-group') ||
          div.classList.contains('fr-select-group') ||
          div.classList.contains('fr-fieldset') ||
          div.classList.contains('fr-upload-group')) continue;

      const hasSelect = div.querySelector('select');
      const hasRadio = div.querySelector('input[type="radio"]');
      const hasCheckboxGroup = div.querySelector('.grist-checkbox-list, [role="group"]');
      const hasFile = div.querySelector('input[type="file"]');
      const hasInput = div.querySelector('input, textarea');
      const hasLabel = div.querySelector('label');

      if (!hasLabel && !hasInput) continue; // Titre, séparateur, etc.

      if (hasSelect) {
        div.classList.add('fr-select-group');
      } else if (hasRadio || hasCheckboxGroup) {
        div.classList.add('fr-fieldset');
      } else if (hasFile) {
        div.classList.add('fr-upload-group');
      } else if (hasInput) {
        div.classList.add('fr-input-group');
      }
    }
  }

  // ── Page de succès ──────────────────────────────────────────────

  function handleSuccessPage() {
    // Après soumission, Grist remplace le formulaire par une page de succès.
    // On la détecte et on lui ajoute un style DSFR "alerte succès".
    const successEl = document.querySelector(
      '[class*="success"], .test-form-success-page, [data-testid*="success"]'
    );
    if (successEl && !successEl.classList.contains('fr-alert')) {
      successEl.classList.add('fr-alert', 'fr-alert--success');
    }
  }

  // ── Observer les changements dynamiques ─────────────────────────

  function observeChanges(form) {
    let debounce;
    const observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        // Re-appliquer les transformations (pour validation, success page, etc.)
        const currentForm = document.querySelector('form');
        if (currentForm) {
          addDsfrClasses(currentForm);
        }
        hideGristChrome();
        handleSuccessPage();
      }, 150);
    });

    const root = form.closest('[data-testid="test-form-framing"]')
               || form.parentElement
               || document.body;
    observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  // ── Utilitaire ──────────────────────────────────────────────────

  function setImportant(el, props) {
    for (const [prop, val] of Object.entries(props)) {
      el.style.setProperty(prop, val, 'important');
    }
  }

  // ── Point d'entrée ──────────────────────────────────────────────

  async function main() {
    const form = await waitForForm();
    if (!form) {
      console.warn('[DSFR] Formulaire non trouvé après 10s');
      return;
    }

    fixLayout();
    hideGristChrome();
    addDsfrClasses(form);
    handleSuccessPage();
    observeChanges(form);

    document.documentElement.setAttribute('data-dsfr-ready', 'true');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
