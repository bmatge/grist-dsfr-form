import { BaseField } from './base-field.js';
import { el } from '../utils/dom.js';

export class RefListField extends BaseField {
  /**
   * @param {Object} column
   * @param {{ id: number, label: string }[]} referenceData - Données de la table référencée
   */
  constructor(column, referenceData = []) {
    super(column);
    this.referenceData = referenceData;
  }

  render() {
    const fieldsetId = `fieldset-${this.colId}`;
    const legendId = `legend-${this.colId}`;

    const elements = this.referenceData.map((item, i) => {
      const checkId = `check-${this.colId}-${i}`;
      return el('div', { className: 'fr-fieldset__element' },
        el('div', { className: 'fr-checkbox-group' },
          el('input', {
            type: 'checkbox',
            id: checkId,
            name: this.colId,
            value: String(item.id),
          }),
          el('label', { className: 'fr-label', for: checkId }, item.label)
        )
      );
    });

    const legendChildren = [this.label];
    if (this.description) {
      legendChildren.push(
        el('span', { className: 'fr-hint-text' }, this.description)
      );
    }

    this._element = el('fieldset', {
      className: 'fr-fieldset',
      id: fieldsetId,
      'aria-labelledby': legendId,
    },
      el('legend', { className: 'fr-fieldset__legend', id: legendId }, ...legendChildren),
      ...elements,
      el('div', { className: 'fr-messages-group', id: `messages-${this.colId}`, 'aria-live': 'polite' })
    );

    return this._element;
  }

  getValue() {
    if (!this._element) return null;
    const checked = this._element.querySelectorAll(`input[name="${this.colId}"]:checked`);
    const values = Array.from(checked).map(cb => parseInt(cb.value, 10));
    return values.length > 0 ? values : null;
  }

  reset() {
    if (this._element) {
      const checks = this._element.querySelectorAll(`input[name="${this.colId}"]`);
      checks.forEach(c => c.checked = false);
    }
  }
}
