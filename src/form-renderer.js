/**
 * Orchestrateur de rendu du formulaire DSFR.
 */
import { resolveFieldType, extractRefTableId } from './field-registry.js';
import { fetchReferenceData } from './grist-api.js';
import { FormState } from './form-state.js';
import { submitForm } from './submission.js';
import { el } from './utils/dom.js';
import { setFieldError, clearFieldError } from './utils/dom.js';

export class FormRenderer {
  /**
   * @param {HTMLElement} container - Élément DOM parent
   * @param {string} tableId - ID de la table Grist
   * @param {Object[]} columns - Métadonnées des colonnes
   * @param {Object} options - Options du widget (title, description, etc.)
   */
  constructor(container, tableId, columns, options = {}) {
    this.container = container;
    this.tableId = tableId;
    this.columns = columns;
    this.options = options;
    this.state = new FormState();
    this._refDataCache = new Map();
  }

  async render() {
    this.container.innerHTML = '';

    // Pré-charger les données de référence pour les champs Ref/RefList
    await this._preloadReferenceData();

    // En-tête du formulaire
    const title = this.options.title || this.tableId;
    const header = el('div', { className: 'fr-mb-4w' },
      el('h1', { className: 'fr-h3' }, title),
    );
    if (this.options.description) {
      header.appendChild(el('p', { className: 'fr-text--lg' }, this.options.description));
    }

    // Zone de feedback
    this._feedbackZone = el('div', { id: 'form-feedback' });

    // Créer le formulaire
    const form = el('form', { id: 'dsfr-form', novalidate: true });

    // Générer chaque champ
    for (const column of this.columns) {
      const { FieldClass, needsRefData } = resolveFieldType(column.type);

      let field;
      if (needsRefData) {
        const refTableId = extractRefTableId(column.type);
        const refData = this._refDataCache.get(refTableId) || [];
        field = new FieldClass(column, refData);
      } else {
        field = new FieldClass(column);
      }

      const fieldElement = field.render();
      const wrapper = el('div', { className: 'fr-mb-3w' }, fieldElement);
      form.appendChild(wrapper);

      this.state.register(column.colId, field);
    }

    // Bouton de soumission
    const submitBtn = el('button', {
      className: 'fr-btn',
      type: 'submit',
    }, 'Envoyer');

    form.appendChild(el('div', { className: 'fr-mt-4w' }, submitBtn));

    // Gestion de la soumission
    form.addEventListener('submit', (e) => this._handleSubmit(e));

    this.container.appendChild(header);
    this.container.appendChild(this._feedbackZone);
    this.container.appendChild(form);

    // Initialiser les composants DSFR sur le DOM dynamique
    this._initDsfr();
  }

  async _preloadReferenceData() {
    // Récupérer toutes les colonnes du document pour résoudre visibleCol
    const allColumns = await grist.docApi.fetchTable('_grist_Tables_column');

    for (const column of this.columns) {
      const refTableId = extractRefTableId(column.type);
      if (refTableId && !this._refDataCache.has(refTableId)) {
        try {
          const data = await fetchReferenceData(refTableId, column.visibleCol, allColumns);
          this._refDataCache.set(refTableId, data);
        } catch (e) {
          console.warn(`Impossible de charger les données de référence pour ${refTableId}:`, e);
          this._refDataCache.set(refTableId, []);
        }
      }
    }
  }

  async _handleSubmit(e) {
    e.preventDefault();

    // Effacer le feedback précédent
    this._feedbackZone.innerHTML = '';

    // Effacer les erreurs précédentes
    for (const colId of this.state.fields.keys()) {
      clearFieldError(colId);
    }

    // Valider
    const requiredFields = this.options.requiredFields || [];
    const { valid, errors } = this.state.validateAll(requiredFields);

    if (!valid) {
      // Afficher les erreurs inline
      for (const [colId, message] of Object.entries(errors)) {
        setFieldError(colId, message);
      }
      // Focus sur le premier champ en erreur
      const firstErrorCol = Object.keys(errors)[0];
      const firstInput = document.getElementById(`input-${firstErrorCol}`)
        || document.getElementById(`fieldset-${firstErrorCol}`);
      firstInput?.focus();

      this._showFeedback('error', 'Veuillez corriger les erreurs dans le formulaire.');
      return;
    }

    // Soumettre
    const submitBtn = this.container.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      const rawValues = this.state.getAllValues();
      await submitForm(this.tableId, rawValues, this.columns);

      this._showFeedback('success', 'Enregistrement ajouté avec succès !');
      this.state.reset();
    } catch (e) {
      console.error('Erreur soumission:', e);
      this._showFeedback('error', `Erreur lors de l'envoi : ${e.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer';
    }
  }

  _showFeedback(type, message) {
    const alertType = type === 'success' ? 'fr-alert--success' : 'fr-alert--error';
    this._feedbackZone.innerHTML = '';
    this._feedbackZone.appendChild(
      el('div', { className: `fr-alert ${alertType} fr-alert--sm fr-mb-2w`, role: 'alert' },
        el('p', {}, message)
      )
    );
    this._feedbackZone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _initDsfr() {
    // DSFR initialise les composants au chargement de la page.
    // Pour le contenu dynamique, on relance l'initialisation.
    if (window.dsfr) {
      try {
        window.dsfr.start();
      } catch (e) {
        // Certaines versions de DSFR ne supportent pas start() sur du contenu dynamique
        console.warn('DSFR start():', e);
      }
    }
  }
}
