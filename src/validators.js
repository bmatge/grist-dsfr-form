/**
 * Règles de validation par type de champ.
 */

export function required(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function isNumeric(value) {
  if (value === null || value === '') return true; // vide = OK (required gère l'obligation)
  return !isNaN(Number(value));
}

export function isInteger(value) {
  if (value === null || value === '') return true;
  const num = Number(value);
  return !isNaN(num) && Number.isInteger(num);
}

export function isValidDate(value) {
  if (!value) return true;
  return !isNaN(new Date(value).getTime());
}
