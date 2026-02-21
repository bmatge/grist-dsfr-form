import { getTableColumns, getTableList, getCurrentTableId } from './grist-api.js';
import { FormRenderer } from './form-renderer.js';

const app = document.getElementById('app');

function showError(message) {
  app.innerHTML = `
    <div class="fr-alert fr-alert--error fr-my-2w">
      <h3 class="fr-alert__title">Erreur</h3>
      <p>${message}</p>
    </div>
  `;
}

function showLoading() {
  app.innerHTML = `
    <div class="fr-callout fr-my-2w">
      <p class="fr-callout__text">Chargement du formulaire...</p>
    </div>
  `;
}

async function init() {
  showLoading();

  try {
    grist.ready({
      requiredAccess: 'full',
      onEditOptions() {
        showConfigPanel();
      },
    });
  } catch (e) {
    showError("Impossible de se connecter à Grist. Ce widget doit être utilisé dans Grist.");
    return;
  }

  grist.onOptions(async (options) => {
    try {
      const tableId = options?.tableId || await getCurrentTableId();
      if (!tableId) {
        showConfigPanel();
        return;
      }
      await renderForm(tableId, options);
    } catch (e) {
      console.error('Erreur initialisation:', e);
      showError(`Erreur lors du chargement : ${e.message}`);
    }
  });
}

async function renderForm(tableId, options = {}) {
  showLoading();

  try {
    const columns = await getTableColumns(tableId);
    const renderer = new FormRenderer(app, tableId, columns, options);
    renderer.render();
  } catch (e) {
    console.error('Erreur rendu formulaire:', e);
    showError(`Erreur lors du rendu du formulaire : ${e.message}`);
  }
}

async function showConfigPanel() {
  try {
    const tables = await getTableList();
    app.innerHTML = `
      <div class="fr-my-2w">
        <h2 class="fr-h4">Configuration du formulaire</h2>
        <div class="fr-select-group">
          <label class="fr-label" for="config-table">
            Table cible
            <span class="fr-hint-text">Sélectionnez la table dans laquelle les données seront enregistrées</span>
          </label>
          <select class="fr-select" id="config-table">
            <option value="" selected disabled hidden>Sélectionnez une table</option>
            ${tables.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="fr-input-group fr-mt-2w">
          <label class="fr-label" for="config-title">
            Titre du formulaire
            <span class="fr-hint-text">Optionnel</span>
          </label>
          <input class="fr-input" type="text" id="config-title" placeholder="Titre du formulaire">
        </div>
        <div class="fr-input-group fr-mt-2w">
          <label class="fr-label" for="config-description">
            Description
            <span class="fr-hint-text">Optionnel — texte affiché en haut du formulaire</span>
          </label>
          <textarea class="fr-input" id="config-description" rows="3" placeholder="Description du formulaire"></textarea>
        </div>
        <button class="fr-btn fr-mt-2w" id="config-save">Enregistrer la configuration</button>
      </div>
    `;

    document.getElementById('config-save').addEventListener('click', async () => {
      const tableId = document.getElementById('config-table').value;
      const title = document.getElementById('config-title').value;
      const description = document.getElementById('config-description').value;

      if (!tableId) return;

      await grist.widgetApi.setOptions({ tableId, title, description });
    });
  } catch (e) {
    console.error('Erreur configuration:', e);
    showError(`Erreur lors du chargement de la configuration : ${e.message}`);
  }
}

init();
