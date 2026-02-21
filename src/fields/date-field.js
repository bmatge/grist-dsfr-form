import { BaseField } from './base-field.js';
import { el, createInputGroup } from '../utils/dom.js';

export class DateField extends BaseField {
  render() {
    const inputId = `input-${this.colId}`;

    this._input = el('input', {
      className: 'fr-input',
      type: 'date',
      id: inputId,
      name: this.colId,
    });

    this._element = createInputGroup(this.colId, this.label, this.description, this._input);
    return this._element;
  }

  getValue() {
    return this._input?.value || null;
  }

  validate() {
    const val = this._input?.value;
    if (!val) return { valid: true };
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      return { valid: false, message: 'Veuillez entrer une date valide' };
    }
    return { valid: true };
  }

  reset() {
    if (this._input) this._input.value = '';
  }
}
