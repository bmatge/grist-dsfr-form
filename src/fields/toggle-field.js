import { BaseField } from './base-field.js';
import { el } from '../utils/dom.js';

export class ToggleField extends BaseField {
  render() {
    const inputId = `input-${this.colId}`;

    this._input = el('input', {
      type: 'checkbox',
      className: 'fr-toggle__input',
      id: inputId,
      name: this.colId,
    });

    const labelChildren = [this.label];
    if (this.description) {
      labelChildren.push(
        el('span', { className: 'fr-hint-text' }, this.description)
      );
    }

    this._element = el('div', { className: 'fr-toggle', id: `group-${this.colId}` },
      this._input,
      el('label', {
        className: 'fr-toggle__label',
        for: inputId,
        dataset: { frCheckedLabel: 'Activé', frUncheckedLabel: 'Désactivé' },
      }, ...labelChildren),
      el('div', { className: 'fr-messages-group', id: `messages-${this.colId}`, 'aria-live': 'polite' })
    );

    return this._element;
  }

  getValue() {
    return this._input?.checked ?? false;
  }

  reset() {
    if (this._input) this._input.checked = false;
  }
}
