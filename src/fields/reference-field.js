import { BaseField } from './base-field.js';
import { el } from '../utils/dom.js';

export class ReferenceField extends BaseField {
  /**
   * @param {Object} column
   * @param {{ id: number, label: string }[]} referenceData - Données de la table référencée
   */
  constructor(column, referenceData = []) {
    super(column);
    this.referenceData = referenceData;
  }

  render() {
    const selectId = `input-${this.colId}`;

    const options = [
      el('option', { value: '', selected: true, disabled: true, hidden: true }, 'Sélectionnez une option'),
      ...this.referenceData.map(item =>
        el('option', { value: String(item.id) }, item.label)
      ),
    ];

    this._select = el('select', { className: 'fr-select', id: selectId, name: this.colId }, ...options);

    const labelChildren = [this.label];
    if (this.description) {
      labelChildren.push(
        el('span', { className: 'fr-hint-text' }, this.description)
      );
    }

    this._element = el('div', { className: 'fr-select-group', id: `group-${this.colId}` },
      el('label', { className: 'fr-label', for: selectId }, ...labelChildren),
      this._select,
      el('div', { className: 'fr-messages-group', id: `messages-${this.colId}`, 'aria-live': 'polite' })
    );

    return this._element;
  }

  getValue() {
    const val = this._select?.value;
    return val ? parseInt(val, 10) : null;
  }

  reset() {
    if (this._select) this._select.selectedIndex = 0;
  }
}
