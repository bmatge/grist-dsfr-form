/**
 * Classe de base pour tous les renderers de champs de formulaire.
 * Chaque type de colonne Grist implémente cette interface.
 */
export class BaseField {
  /**
   * @param {Object} column - Métadonnées de la colonne Grist
   * @param {string} column.colId - Identifiant de la colonne
   * @param {string} column.type - Type Grist (Text, Numeric, etc.)
   * @param {string} column.label - Label affiché
   * @param {string} column.description - Description/hint
   * @param {Object} column.widgetOptions - Options du widget
   */
  constructor(column) {
    this.column = column;
    this.colId = column.colId;
    this.label = column.label;
    this.description = column.description;
    this.type = column.type;
    this.widgetOptions = column.widgetOptions || {};
    this._element = null;
  }

  /**
   * Construit et retourne l'élément DOM du champ.
   * @returns {HTMLElement}
   */
  render() {
    throw new Error('render() doit être implémenté');
  }

  /**
   * Retourne la valeur actuelle du champ (valeur brute JS, pas encore encodée).
   * @returns {*}
   */
  getValue() {
    throw new Error('getValue() doit être implémenté');
  }

  /**
   * Valide la valeur du champ.
   * @returns {{ valid: boolean, message?: string }}
   */
  validate() {
    return { valid: true };
  }

  /**
   * Réinitialise le champ à sa valeur par défaut.
   */
  reset() {
    // Implémenté par les sous-classes
  }
}
