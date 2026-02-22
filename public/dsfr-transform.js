/**
 * DSFR Form Renderer
 *
 * Reconstruit entièrement le formulaire Grist en composants DSFR natifs.
 *
 * Flux :
 * 1. Attend que form.bundle.js rende le formulaire Grist
 * 2. Extrait les champs (label, type, options, requis, description)
 * 3. Masque l'interface Grist (position off-screen, pas display:none
 *    pour que React continue de fonctionner)
 * 4. Construit un formulaire 100% DSFR
 * 5. À la soumission, synchronise les valeurs vers le formulaire Grist
 *    caché et déclenche son submit natif
 * 6. Détecte le succès/erreur et affiche le résultat en DSFR
 */
(function () {
  'use strict';

  // ── Attente du rendu Grist ──────────────────────────────────────

  function waitForForm() {
    return new Promise((resolve) => {
      const check = () => {
        const f = document.querySelector('form');
        // Le formulaire est prêt quand il a un bouton submit
        if (f && f.querySelector('button[type="submit"]')) return f;
        return null;
      };
      const found = check();
      if (found) return resolve(found);

      const observer = new MutationObserver(() => {
        const f = check();
        if (f) { observer.disconnect(); resolve(f); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(check()); }, 15000);
    });
  }

  // ── Extraction des sections du formulaire ───────────────────────

  function extractFormContent(form) {
    const sections = [];
    collectSections(form, sections, 0);
    return sections;
  }

  /**
   * Parcourt récursivement les enfants d'un conteneur pour trouver
   * les sections du formulaire (headers, champs, séparateurs, submit).
   *
   * Heuristique clé : on compte les noms de champs (attribut name) distincts
   * dans chaque div. Si > 1 nom → c'est un conteneur intermédiaire, on descend.
   * Si == 1 → c'est un champ unique, on l'extrait.
   */
  function collectSections(container, sections, depth) {
    if (depth > 15) return; // garde-fou

    for (const child of container.children) {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;

      // Séparateur
      if (child.tagName === 'HR' || (child.children.length <= 2 && child.querySelector(':scope > hr'))) {
        sections.push({ type: 'separator' });
        continue;
      }

      // Compter les noms de champs distincts dans ce div
      const inputs = child.querySelectorAll('input, select, textarea');
      const fieldNames = new Set();
      inputs.forEach(i => { if (i.name) fieldNames.add(i.name); });
      const hasInput = inputs.length > 0;
      const hasLabel = !!child.querySelector('label');

      // Section titre (heading sans champs de saisie)
      if (!hasInput) {
        const heading = child.querySelector('h1, h2, h3');
        if (heading) {
          const paragraphs = child.querySelectorAll('p');
          sections.push({
            type: 'header',
            level: parseInt(heading.tagName[1]),
            title: heading.textContent.trim(),
            description: Array.from(paragraphs).map(p => p.textContent.trim()).filter(Boolean).join('\n'),
          });
          continue;
        }

        // Bouton submit seul (sans champs)
        const submitBtn = child.querySelector('button[type="submit"]');
        if (submitBtn) {
          sections.push({
            type: 'submit',
            text: submitBtn.textContent.trim(),
            gristButton: submitBtn,
          });
          continue;
        }

        // Paragraphe isolé
        const text = child.textContent.trim();
        if (text) {
          sections.push({ type: 'paragraph', text });
        }
        continue;
      }

      // Plusieurs noms de champs → conteneur intermédiaire, descendre
      if (fieldNames.size > 1) {
        collectSections(child, sections, depth + 1);
        continue;
      }

      // Un seul nom de champ + label → c'est un champ
      if (fieldNames.size === 1 && hasLabel) {
        const field = extractField(child);
        if (field) { sections.push(field); continue; }
      }

      // Un seul nom mais pas de label, ou extractField a échoué →
      // c'est peut-être un conteneur avec un submit + des enfants
      if (child.children.length > 0 && (hasLabel || child.querySelector('button[type="submit"]'))) {
        collectSections(child, sections, depth + 1);
        continue;
      }
    }
  }

  function extractField(questionDiv) {
    // ── Label principal ──
    let mainLabel = null;
    for (const l of questionDiv.querySelectorAll('label')) {
      if (!l.querySelector('input[type="radio"], input[type="checkbox"]')) {
        mainLabel = l;
        break;
      }
    }
    // Fallback : label identifié par aria-labelledby
    if (!mainLabel) {
      const ariaId = questionDiv.querySelector('[aria-labelledby]')?.getAttribute('aria-labelledby');
      if (ariaId) mainLabel = document.getElementById(ariaId);
    }

    const labelText = mainLabel ? cleanLabelText(mainLabel) : '';
    const isRequired = !!(
      questionDiv.querySelector('[class*="required"]') ||
      questionDiv.querySelector('input[required], select[required], textarea[required]')
    );

    // ── Description (hint) ──
    let description = null;
    if (mainLabel && mainLabel.parentElement) {
      for (const el of mainLabel.parentElement.children) {
        if (el === mainLabel) continue;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') continue;
        const t = el.textContent.trim();
        if (t && t !== '*' && t !== labelText) { description = t; break; }
      }
    }

    // ── Type de champ ──
    const radios = questionDiv.querySelectorAll('input[type="radio"]');
    const checkboxes = questionDiv.querySelectorAll('input[type="checkbox"]');
    const isSingleToggle = checkboxes.length === 1 &&
      !questionDiv.querySelector('[role="group"], .grist-checkbox-list');

    if (radios.length > 0) {
      return {
        type: 'field', inputType: 'radio', name: radios[0].name,
        label: labelText, required: isRequired, description,
        options: Array.from(radios).map(r => ({
          value: r.value, label: getOptionLabel(r), gristInput: r,
        })),
      };
    }

    if (checkboxes.length > 0 && !isSingleToggle) {
      return {
        type: 'field', inputType: 'checkbox', name: checkboxes[0].name,
        label: labelText, required: isRequired, description,
        options: Array.from(checkboxes).map(c => ({
          value: c.value, label: getOptionLabel(c), gristInput: c,
        })),
      };
    }

    if (isSingleToggle) {
      return {
        type: 'field', inputType: 'toggle', name: checkboxes[0].name,
        label: labelText, required: isRequired, description,
        gristInput: checkboxes[0],
      };
    }

    const select = questionDiv.querySelector('select');
    if (select) {
      return {
        type: 'field', inputType: 'select', name: select.name,
        label: labelText, required: isRequired, description,
        options: Array.from(select.options).filter(o => o.value).map(o => ({
          value: o.value, label: o.textContent.trim(),
        })),
        gristInput: select,
      };
    }

    const textarea = questionDiv.querySelector('textarea');
    if (textarea) {
      return {
        type: 'field', inputType: 'textarea', name: textarea.name,
        label: labelText, required: isRequired, description,
        gristInput: textarea,
      };
    }

    const fileInput = questionDiv.querySelector('input[type="file"]');
    if (fileInput) {
      return {
        type: 'field', inputType: 'file', name: fileInput.name,
        label: labelText, required: isRequired, description,
        gristInput: fileInput,
      };
    }

    // Input générique (text, number, date, email…)
    const input = questionDiv.querySelector(
      'input[type="text"], input[type="number"], input[type="email"], ' +
      'input[type="tel"], input[type="url"], input[type="password"], ' +
      'input[type="date"], input[type="datetime-local"], input[type="time"], ' +
      'input:not([type])'
    );
    if (input) {
      return {
        type: 'field', inputType: input.type || 'text', name: input.name,
        label: labelText, required: isRequired, description,
        gristInput: input,
      };
    }

    return null;
  }

  /** Extrait le texte du label en retirant l'indicateur requis (*) */
  function cleanLabelText(label) {
    const clone = label.cloneNode(true);
    clone.querySelectorAll('input, [class*="required"]').forEach(el => el.remove());
    return clone.textContent.trim().replace(/\s*\*\s*$/, '');
  }

  /** Extrait le texte visible d'une option radio/checkbox */
  function getOptionLabel(input) {
    const label = input.closest('label');
    if (label) {
      const span = label.querySelector('span');
      if (span) return span.textContent.trim();
      const clone = label.cloneNode(true);
      clone.querySelectorAll('input').forEach(el => el.remove());
      return clone.textContent.trim();
    }
    // Fallback : label[for]
    if (input.id) {
      const forLabel = document.querySelector(`label[for="${input.id}"]`);
      if (forLabel) return forLabel.textContent.trim();
    }
    return input.value;
  }

  // ── Construction du formulaire DSFR ─────────────────────────────

  function buildDsfrPage(sections) {
    const main = document.createElement('main');
    main.id = 'dsfr-main';
    main.className = 'fr-py-4w';

    const container = document.createElement('div');
    container.className = 'fr-container';

    const row = document.createElement('div');
    row.className = 'fr-grid-row fr-grid-row--center';

    const col = document.createElement('div');
    col.className = 'fr-col-12 fr-col-md-10 fr-col-lg-8';

    const form = document.createElement('form');
    form.id = 'dsfr-form';

    for (const section of sections) {
      const el = buildSection(section);
      if (el) form.appendChild(el);
    }

    col.appendChild(form);
    row.appendChild(col);
    container.appendChild(row);
    main.appendChild(container);
    return main;
  }

  function buildSection(section) {
    switch (section.type) {
      case 'header': return buildHeader(section);
      case 'separator': {
        const hr = document.createElement('hr');
        hr.className = 'fr-hr fr-my-3w';
        return hr;
      }
      case 'paragraph': {
        const p = document.createElement('p');
        p.className = 'fr-text--sm fr-mb-3w';
        p.textContent = section.text;
        return p;
      }
      case 'field': return buildField(section);
      case 'submit': return buildSubmit(section);
      default: return null;
    }
  }

  function buildHeader(section) {
    const div = document.createElement('div');
    div.className = 'fr-mb-4w';
    const tag = section.level === 1 ? 'h2' : 'h3'; // h1 reservé pour le titre du site
    const heading = document.createElement(tag);
    heading.textContent = section.title;
    div.appendChild(heading);
    if (section.description) {
      for (const line of section.description.split('\n')) {
        const p = document.createElement('p');
        p.className = 'fr-text--lg';
        p.textContent = line;
        div.appendChild(p);
      }
    }
    return div;
  }

  function buildField(field) {
    const id = `dsfr-${field.name}`;
    const reqHtml = field.required ? ' *' : '';
    const hintHtml = field.description
      ? `<span class="fr-hint-text">${esc(field.description)}</span>` : '';

    switch (field.inputType) {
      case 'text': case 'number': case 'email': case 'tel': case 'url':
      case 'password': case 'date': case 'datetime-local': case 'time': {
        const g = el('div', 'fr-input-group fr-mb-3w');
        g.innerHTML = `
          <label class="fr-label" for="${id}">${esc(field.label)}${reqHtml}${hintHtml}</label>
          <input class="fr-input" type="${field.inputType}" id="${id}"
                 name="${field.name}" ${field.required ? 'required' : ''}>`;
        return g;
      }

      case 'textarea': {
        const g = el('div', 'fr-input-group fr-mb-3w');
        g.innerHTML = `
          <label class="fr-label" for="${id}">${esc(field.label)}${reqHtml}${hintHtml}</label>
          <textarea class="fr-input" id="${id}" name="${field.name}" rows="5"
                    ${field.required ? 'required' : ''}></textarea>`;
        return g;
      }

      case 'select': {
        const g = el('div', 'fr-select-group fr-mb-3w');
        g.innerHTML = `
          <label class="fr-label" for="${id}">${esc(field.label)}${reqHtml}${hintHtml}</label>
          <select class="fr-select" id="${id}" name="${field.name}"
                  ${field.required ? 'required' : ''}>
            <option value="" selected disabled hidden>Sélectionnez une option</option>
            ${field.options.map(o => `<option value="${attr(o.value)}">${esc(o.label)}</option>`).join('')}
          </select>`;
        return g;
      }

      case 'radio': {
        const g = el('div', 'fr-form-group fr-mb-3w');
        g.innerHTML = `
          <fieldset class="fr-fieldset" aria-labelledby="${id}-legend">
            <legend class="fr-fieldset__legend--regular fr-fieldset__legend" id="${id}-legend">
              ${esc(field.label)}${reqHtml}${hintHtml}
            </legend>
            <div class="fr-fieldset__content">
              ${field.options.map((o, i) => `
                <div class="fr-radio-group">
                  <input type="radio" id="${id}-${i}" name="${field.name}"
                         value="${attr(o.value)}" ${field.required ? 'required' : ''}>
                  <label class="fr-label" for="${id}-${i}">${esc(o.label)}</label>
                </div>`).join('')}
            </div>
          </fieldset>`;
        return g;
      }

      case 'checkbox': {
        const g = el('div', 'fr-form-group fr-mb-3w');
        g.innerHTML = `
          <fieldset class="fr-fieldset" aria-labelledby="${id}-legend">
            <legend class="fr-fieldset__legend--regular fr-fieldset__legend" id="${id}-legend">
              ${esc(field.label)}${reqHtml}${hintHtml}
            </legend>
            <div class="fr-fieldset__content">
              ${field.options.map((o, i) => `
                <div class="fr-checkbox-group">
                  <input type="checkbox" id="${id}-${i}" name="${field.name}"
                         value="${attr(o.value)}">
                  <label class="fr-label" for="${id}-${i}">${esc(o.label)}</label>
                </div>`).join('')}
            </div>
          </fieldset>`;
        return g;
      }

      case 'toggle': {
        const g = el('div', 'fr-toggle fr-mb-3w');
        g.innerHTML = `
          <input type="checkbox" id="${id}" name="${field.name}" class="fr-toggle__input">
          <label class="fr-toggle__label" for="${id}">${esc(field.label)}${hintHtml}</label>`;
        return g;
      }

      case 'file': {
        const g = el('div', 'fr-upload-group fr-mb-3w');
        g.innerHTML = `
          <label class="fr-label" for="${id}">${esc(field.label)}${reqHtml}${hintHtml}</label>
          <input class="fr-upload" type="file" id="${id}" name="${field.name}"
                 ${field.required ? 'required' : ''}>`;
        return g;
      }

      default: {
        const g = el('div', 'fr-input-group fr-mb-3w');
        g.innerHTML = `
          <label class="fr-label" for="${id}">${esc(field.label)}${reqHtml}${hintHtml}</label>
          <input class="fr-input" type="text" id="${id}" name="${field.name}"
                 ${field.required ? 'required' : ''}>`;
        return g;
      }
    }
  }

  function buildSubmit(section) {
    const div = el('div', 'fr-btns-group fr-mt-4w');
    div.innerHTML = `
      <button class="fr-btn" type="submit">${esc(section.text || 'Envoyer')}</button>`;
    return div;
  }

  // ── Masquer l'interface Grist ───────────────────────────────────

  function hideGristUI() {
    for (const child of document.body.children) {
      if (child.tagName === 'HEADER' || child.tagName === 'FOOTER') continue;
      if (child.tagName === 'MAIN' && child.id === 'dsfr-main') continue;
      if (child.tagName === 'SCRIPT') continue;
      if (child.classList.contains('fr-header') || child.classList.contains('fr-footer')) continue;
      // Masquer hors-écran (pas display:none pour garder React actif)
      child.style.cssText =
        'position:fixed!important;left:-9999px!important;top:-9999px!important;' +
        'width:1px!important;height:1px!important;overflow:hidden!important;' +
        'pointer-events:none!important;';
      child.setAttribute('aria-hidden', 'true');
      return child;
    }
    return null;
  }

  // ── Synchronisation DSFR → Grist et soumission ─────────────────

  function syncToGrist(dsfrForm, sections) {
    const fields = sections.filter(s => s.type === 'field');

    for (const field of fields) {
      switch (field.inputType) {
        case 'radio': {
          const val = dsfrForm.querySelector(`input[name="${field.name}"]:checked`)?.value;
          if (val) {
            const target = field.options.find(o => o.value === val)?.gristInput;
            if (target && !target.checked) target.click();
          }
          break;
        }
        case 'checkbox': {
          for (const opt of field.options) {
            const dsfrCb = dsfrForm.querySelector(
              `input[name="${CSS.escape(field.name)}"][value="${CSS.escape(opt.value)}"]`
            );
            const wantChecked = dsfrCb?.checked ?? false;
            if (wantChecked !== opt.gristInput.checked) opt.gristInput.click();
          }
          break;
        }
        case 'toggle': {
          const dsfrToggle = dsfrForm.querySelector(`input[name="${field.name}"]`);
          if (dsfrToggle && dsfrToggle.checked !== field.gristInput.checked) {
            field.gristInput.click();
          }
          break;
        }
        case 'select': {
          const dsfrSelect = dsfrForm.querySelector(`select[name="${field.name}"]`);
          if (dsfrSelect?.value) setReactValue(field.gristInput, dsfrSelect.value, 'change');
          break;
        }
        case 'file': {
          const dsfrFile = dsfrForm.querySelector(`input[name="${field.name}"]`);
          if (dsfrFile?.files?.length) {
            const dt = new DataTransfer();
            for (const f of dsfrFile.files) dt.items.add(f);
            field.gristInput.files = dt.files;
            field.gristInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }
        case 'textarea': {
          const dsfrTa = dsfrForm.querySelector(`textarea[name="${field.name}"]`);
          if (dsfrTa) setReactValue(field.gristInput, dsfrTa.value, 'input');
          break;
        }
        default: {
          const dsfrInput = dsfrForm.querySelector(`input[name="${field.name}"]`);
          if (dsfrInput) setReactValue(field.gristInput, dsfrInput.value, 'input');
        }
      }
    }

    // Déclencher le submit Grist
    const submitSection = sections.find(s => s.type === 'submit');
    if (submitSection?.gristButton) {
      submitSection.gristButton.click();
    }
  }

  /** Modifie la valeur d'un input contrôlé par React */
  function setReactValue(element, value, eventType) {
    const protoMap = {
      INPUT: HTMLInputElement.prototype,
      TEXTAREA: HTMLTextAreaElement.prototype,
      SELECT: HTMLSelectElement.prototype,
    };
    const proto = protoMap[element.tagName];
    const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  }

  // ── Détection du résultat (succès / erreur) ─────────────────────

  function watchForResult(gristRoot, dsfrMain, dsfrForm) {
    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      // Succès : le <form> a disparu (remplacé par la page de succès)
      if (!gristRoot.querySelector('form')) {
        done = true;
        observer.disconnect();
        showSuccess(dsfrMain);
      }
    });
    observer.observe(gristRoot, { childList: true, subtree: true });

    // Timeout : si rien après 10s, ré-activer le bouton
    setTimeout(() => {
      if (!done) {
        observer.disconnect();
        const btn = dsfrForm.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
      }
    }, 10000);
  }

  function showSuccess(dsfrMain) {
    dsfrMain.innerHTML = `
      <div class="fr-container fr-py-8w">
        <div class="fr-grid-row fr-grid-row--center">
          <div class="fr-col-12 fr-col-md-8 fr-col-lg-6">
            <div class="fr-alert fr-alert--success">
              <h3 class="fr-alert__title">Merci !</h3>
              <p>Votre réponse a bien été enregistrée.</p>
            </div>
            <div class="fr-btns-group fr-mt-4w">
              <button class="fr-btn fr-btn--secondary"
                      onclick="window.location.reload()">
                Soumettre une autre réponse
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── Utilitaires ─────────────────────────────────────────────────

  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function attr(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Point d'entrée ──────────────────────────────────────────────

  async function main() {
    console.log('[DSFR] Attente du formulaire Grist…');
    const gristForm = await waitForForm();
    if (!gristForm) {
      console.warn('[DSFR] Formulaire non trouvé — affichage Grist natif');
      return;
    }

    console.log('[DSFR] Extraction des champs…');
    const sections = extractFormContent(gristForm);
    console.log('[DSFR] Sections extraites:', sections.map(s =>
      s.type === 'field' ? `${s.inputType}:${s.name}` : s.type
    ));

    // Si on n'a extrait aucun champ, ne pas remplacer le formulaire
    if (!sections.some(s => s.type === 'field')) {
      console.warn('[DSFR] Aucun champ extrait — affichage Grist natif');
      return;
    }

    // Construire le formulaire DSFR
    const dsfrPage = buildDsfrPage(sections);

    // Masquer l'interface Grist
    const gristRoot = hideGristUI();

    // Insérer le formulaire DSFR après le header
    const header = document.querySelector('header.fr-header');
    if (header) {
      header.after(dsfrPage);
    } else {
      document.body.prepend(dsfrPage);
    }

    // Gérer la soumission
    const dsfrForm = dsfrPage.querySelector('#dsfr-form');
    dsfrForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = dsfrForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';

      syncToGrist(dsfrForm, sections);

      if (gristRoot) {
        watchForResult(gristRoot, dsfrPage, dsfrForm);
      }
    });

    console.log('[DSFR] Formulaire DSFR prêt');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
