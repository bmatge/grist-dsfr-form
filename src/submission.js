/**
 * Gestion de la soumission du formulaire.
 */
import { encodeValue } from './utils/encoding.js';
import { addRecord, uploadAttachment } from './grist-api.js';

/**
 * Soumet le formulaire : encode les valeurs, upload les pièces jointes, crée l'enregistrement.
 * @param {string} tableId - ID de la table cible
 * @param {Object<string, *>} rawValues - Valeurs brutes du formulaire (colId → valeur)
 * @param {Object[]} columns - Métadonnées des colonnes
 */
export async function submitForm(tableId, rawValues, columns) {
  const encodedValues = {};

  for (const col of columns) {
    const raw = rawValues[col.colId];
    if (raw === null || raw === undefined) continue;

    // Cas spécial : pièces jointes (il faut uploader d'abord)
    if (col.type === 'Attachments' && Array.isArray(raw)) {
      const attachmentIds = [];
      for (const file of raw) {
        const attId = await uploadAttachment(file);
        attachmentIds.push(attId);
      }
      encodedValues[col.colId] = encodeValue('Attachments', attachmentIds);
      continue;
    }

    const encoded = encodeValue(col.type, raw);
    if (encoded !== null && encoded !== undefined) {
      encodedValues[col.colId] = encoded;
    }
  }

  await addRecord(tableId, encodedValues);
}
