/**
 * Abstraction de l'API Grist pour le widget formulaire DSFR.
 */

/**
 * Récupère la liste des tables du document.
 */
export async function getTableList() {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  return tables.tableId.filter(id => !id.startsWith('GristHidden_'));
}

/**
 * Tente de détecter l'ID de la table courante associée au widget.
 * Retourne null si impossible à déterminer.
 */
export async function getCurrentTableId() {
  return new Promise((resolve) => {
    let resolved = false;
    grist.onRecords((records, mappings) => {
      if (!resolved) {
        resolved = true;
        // On ne peut pas déterminer la table directement depuis onRecords,
        // on retourne null pour forcer la configuration manuelle
        resolve(null);
      }
    });
    // Timeout si onRecords ne se déclenche pas
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 2000);
  });
}

/**
 * Récupère les métadonnées des colonnes d'une table.
 * Lit les tables internes _grist_Tables et _grist_Tables_column.
 */
export async function getTableColumns(tableId) {
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');

  // Trouver le ref interne de la table
  const tableIndex = tables.tableId.indexOf(tableId);
  if (tableIndex === -1) {
    throw new Error(`Table "${tableId}" introuvable`);
  }
  const tableRef = tables.id[tableIndex];

  // Filtrer les colonnes de cette table
  const result = [];
  for (let i = 0; i < columns.id.length; i++) {
    if (columns.parentId[i] !== tableRef) continue;

    const colId = columns.colId[i];

    // Exclure les colonnes internes
    if (colId.startsWith('gristHelper_') || colId === 'manualSort') continue;

    // Exclure les colonnes formule (sauf les trigger formulas)
    if (columns.isFormula[i] && columns.formula[i]) continue;

    let widgetOptions = {};
    try {
      widgetOptions = JSON.parse(columns.widgetOptions[i] || '{}');
    } catch (e) {
      // ignore
    }

    result.push({
      id: columns.id[i],
      colId,
      type: columns.type[i],
      label: columns.label[i] || colId,
      widgetOptions,
      isFormula: columns.isFormula[i],
      formula: columns.formula[i],
      visibleCol: columns.visibleCol[i],
      description: columns.description[i] || '',
      parentPos: columns.parentPos[i],
    });
  }

  // Trier par position dans la table
  result.sort((a, b) => a.parentPos - b.parentPos);

  return result;
}

/**
 * Récupère les données d'une table référencée pour peupler un select/checkbox.
 * Retourne un tableau de { id, label }.
 */
export async function fetchReferenceData(refTableId, visibleColRef, columns) {
  const data = await grist.docApi.fetchTable(refTableId);
  const rowIds = data.id;

  // Trouver le nom de la colonne visible
  let visibleColName = null;
  if (visibleColRef) {
    for (let i = 0; i < columns.id.length; i++) {
      if (columns.id[i] === visibleColRef) {
        visibleColName = columns.colId[i];
        break;
      }
    }
  }

  // Si pas de colonne visible trouvée, chercher la première colonne texte ou utiliser l'id
  if (!visibleColName) {
    const colNames = Object.keys(data).filter(k => k !== 'id' && k !== 'manualSort');
    visibleColName = colNames[0] || 'id';
  }

  const labels = data[visibleColName] || rowIds;

  return rowIds.map((id, i) => ({
    id,
    label: String(labels[i] ?? id),
  }));
}

/**
 * Crée un nouvel enregistrement dans une table.
 */
export async function addRecord(tableId, values) {
  await grist.docApi.applyUserActions([
    ['AddRecord', tableId, null, values],
  ]);
}

/**
 * Upload un fichier en pièce jointe via l'API REST.
 * Retourne l'ID de l'attachment.
 */
export async function uploadAttachment(file) {
  const tokenInfo = await grist.docApi.getAccessToken({ readOnly: false });
  const formData = new FormData();
  formData.append('upload', file, file.name);

  const response = await fetch(
    `${tokenInfo.baseUrl}/attachments?auth=${tokenInfo.token}`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    throw new Error(`Erreur upload : ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result[0];
}
