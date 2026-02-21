/**
 * Store central des valeurs du formulaire.
 */
export class FormState {
  constructor() {
    /** @type {Map<string, import('./fields/base-field.js').BaseField>} */
    this._fields = new Map();
  }

  /**
   * Enregistre un champ dans le state.
   */
  register(colId, field) {
    this._fields.set(colId, field);
  }

  /**
   * Récupère la valeur brute d'un champ.
   */
  getValue(colId) {
    return this._fields.get(colId)?.getValue();
  }

  /**
   * Récupère toutes les valeurs brutes.
   * @returns {Object<string, *>}
   */
  getAllValues() {
    const values = {};
    for (const [colId, field] of this._fields) {
      values[colId] = field.getValue();
    }
    return values;
  }

  /**
   * Valide tous les champs.
   * @param {string[]} requiredFields - Liste des colId requis
   * @returns {{ valid: boolean, errors: Object<string, string> }}
   */
  validateAll(requiredFields = []) {
    const errors = {};
    let valid = true;

    for (const [colId, field] of this._fields) {
      // Validation required
      if (requiredFields.includes(colId)) {
        const val = field.getValue();
        if (val === null || val === undefined || val === '' ||
            (Array.isArray(val) && val.length === 0)) {
          errors[colId] = 'Ce champ est requis';
          valid = false;
          continue;
        }
      }

      // Validation spécifique au type
      const result = field.validate();
      if (!result.valid) {
        errors[colId] = result.message;
        valid = false;
      }
    }

    return { valid, errors };
  }

  /**
   * Réinitialise tous les champs.
   */
  reset() {
    for (const field of this._fields.values()) {
      field.reset();
    }
  }

  /**
   * Retourne la Map des champs.
   */
  get fields() {
    return this._fields;
  }
}
