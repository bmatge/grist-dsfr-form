import { BaseField } from './base-field.js';
import { el, createInputGroup } from '../utils/dom.js';

export class NumericField extends BaseField {
  render() {
    const inputId = `input-${this.colId}`;
    const isInt = this.type === 'Int';

    this._input = el('input', {
      className: 'fr-input',
      type: 'number',
      id: inputId,
      name: this.colId,
      step: isInt ? '1' : 'any',
      inputmode: isInt ? 'numeric' : 'decimal',
    });

    this._element = createInputGroup(this.colId, this.label, this.description, this._input);
    return this._element;
  }

  getValue() {
    const val = this._input?.value?.trim();
    if (!val) return null;
    return this.type === 'Int' ? parseInt(val, 10) : parseFloat(val);
  }

  validate() {
    const val = this._input?.value?.trim();
    if (!val) return { valid: true };

    const num = Number(val);
    if (isNaN(num)) {
      return { valid: false, message: 'Veuillez entrer un nombre valide' };
    }
    if (this.type === 'Int' && !Number.isInteger(num)) {
      return { valid: false, message: 'Veuillez entrer un nombre entier' };
    }
    return { valid: true };
  }

  reset() {
    if (this._input) this._input.value = '';
  }
}
