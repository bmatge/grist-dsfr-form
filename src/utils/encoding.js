/**
 * Encodage des valeurs JavaScript vers le format Grist CellValue.
 */

/**
 * Encode une valeur de formulaire vers le format attendu par Grist AddRecord.
 * @param {string} type - Type de la colonne Grist (ex: "Text", "Numeric", "Ref:Table1")
 * @param {*} rawValue - Valeur brute du formulaire
 * @returns {*} Valeur encodée pour Grist
 */
export function encodeValue(type, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  if (type === 'Text') {
    return String(rawValue);
  }

  if (type === 'Numeric') {
    const num = parseFloat(rawValue);
    return isNaN(num) ? null : num;
  }

  if (type === 'Int') {
    const num = parseInt(rawValue, 10);
    return isNaN(num) ? null : num;
  }

  if (type === 'Bool') {
    return Boolean(rawValue);
  }

  if (type === 'Date') {
    return dateToEpoch(rawValue);
  }

  if (type.startsWith('DateTime')) {
    return dateTimeToEpoch(rawValue);
  }

  if (type === 'Choice') {
    return String(rawValue);
  }

  if (type === 'ChoiceList') {
    if (Array.isArray(rawValue) && rawValue.length > 0) {
      return ['L', ...rawValue];
    }
    return null;
  }

  if (type.startsWith('Ref:')) {
    const num = parseInt(rawValue, 10);
    return isNaN(num) ? 0 : num;
  }

  if (type.startsWith('RefList:')) {
    if (Array.isArray(rawValue) && rawValue.length > 0) {
      return ['L', ...rawValue.map(Number)];
    }
    return null;
  }

  if (type === 'Attachments') {
    if (Array.isArray(rawValue) && rawValue.length > 0) {
      return ['L', ...rawValue];
    }
    return null;
  }

  return rawValue;
}

/**
 * Convertit une date ISO (YYYY-MM-DD) en epoch secondes UTC.
 */
function dateToEpoch(dateStr) {
  if (!dateStr) return null;
  const ms = Date.UTC(
    parseInt(dateStr.slice(0, 4), 10),
    parseInt(dateStr.slice(5, 7), 10) - 1,
    parseInt(dateStr.slice(8, 10), 10)
  );
  return Math.floor(ms / 1000);
}

/**
 * Convertit une date + heure en epoch secondes.
 * rawValue peut être { date: "YYYY-MM-DD", time: "HH:MM" }
 */
function dateTimeToEpoch(rawValue) {
  if (!rawValue || !rawValue.date) return null;
  const time = rawValue.time || '00:00';
  const [hours, minutes] = time.split(':').map(Number);
  const ms = Date.UTC(
    parseInt(rawValue.date.slice(0, 4), 10),
    parseInt(rawValue.date.slice(5, 7), 10) - 1,
    parseInt(rawValue.date.slice(8, 10), 10),
    hours,
    minutes
  );
  return Math.floor(ms / 1000);
}
