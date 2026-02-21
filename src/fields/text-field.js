import { BaseField } from './base-field.js';
import { el, createInputGroup } from '../utils/dom.js';

export class TextField extends BaseField {
  render() {
    const inputId = `input-${this.colId}`;
    const isMultiline = this.widgetOptions.widget === 'TextBox'
      ? false
      : (this.widgetOptions.widget === 'NoteBox' || this.type === 'Text');

    // Utiliser textarea si multiline est explicitement défini dans widgetOptions
    const useTextarea = this.widgetOptions.widget === 'NoteBox';

    if (useTextarea) {
      this._input = el('textarea', {
        className: 'fr-input',
        id: inputId,
        name: this.colId,
        rows: '4',
      });
    } else {
      this._input = el('input', {
        className: 'fr-input',
        type: 'text',
        id: inputId,
        name: this.colId,
      });
    }

    this._element = createInputGroup(this.colId, this.label, this.description, this._input);
    return this._element;
  }

  getValue() {
    const val = this._input?.value?.trim();
    return val || null;
  }

  reset() {
    if (this._input) this._input.value = '';
  }
}
