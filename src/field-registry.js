/**
 * Registre de mapping entre les types de colonnes Grist et les classes de rendu.
 */
import { TextField } from './fields/text-field.js';
import { NumericField } from './fields/numeric-field.js';
import { ToggleField } from './fields/toggle-field.js';
import { DateField } from './fields/date-field.js';
import { DateTimeField } from './fields/datetime-field.js';
import { ChoiceField } from './fields/choice-field.js';
import { ChoiceListField } from './fields/choicelist-field.js';
import { ReferenceField } from './fields/reference-field.js';
import { RefListField } from './fields/reflist-field.js';
import { AttachmentField } from './fields/attachment-field.js';

const EXACT_TYPES = {
  'Text':       TextField,
  'Numeric':    NumericField,
  'Int':        NumericField,
  'Bool':       ToggleField,
  'Date':       DateField,
  'Choice':     ChoiceField,
  'ChoiceList':  ChoiceListField,
  'Attachments': AttachmentField,
};

/**
 * Résout la classe de rendu pour un type de colonne Grist.
 * @param {string} type - Type Grist (ex: "Text", "Ref:Clients", "DateTime:Europe/Paris")
 * @returns {{ FieldClass: typeof import('./fields/base-field.js').BaseField, needsRefData: boolean }}
 */
export function resolveFieldType(type) {
  // Types exacts
  if (EXACT_TYPES[type]) {
    return { FieldClass: EXACT_TYPES[type], needsRefData: false };
  }

  // DateTime (peut inclure timezone: "DateTime:Europe/Paris")
  if (type.startsWith('DateTime')) {
    return { FieldClass: DateTimeField, needsRefData: false };
  }

  // Reference: "Ref:TableName"
  if (type.startsWith('Ref:')) {
    return { FieldClass: ReferenceField, needsRefData: true };
  }

  // Reference list: "RefList:TableName"
  if (type.startsWith('RefList:')) {
    return { FieldClass: RefListField, needsRefData: true };
  }

  // Fallback : champ texte
  console.warn(`Type inconnu "${type}", utilisation du champ texte par défaut`);
  return { FieldClass: TextField, needsRefData: false };
}

/**
 * Extrait le nom de la table référencée depuis un type Ref ou RefList.
 * @param {string} type - Ex: "Ref:Clients" ou "RefList:Produits"
 * @returns {string|null}
 */
export function extractRefTableId(type) {
  if (type.startsWith('Ref:')) return type.slice(4);
  if (type.startsWith('RefList:')) return type.slice(8);
  return null;
}
