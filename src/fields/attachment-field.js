import { BaseField } from './base-field.js';
import { el } from '../utils/dom.js';

export class AttachmentField extends BaseField {
  render() {
    const inputId = `input-${this.colId}`;

    this._input = el('input', {
      className: 'fr-upload',
      type: 'file',
      id: inputId,
      name: this.colId,
      multiple: true,
    });

    const labelChildren = [this.label];
    const hint = this.description || 'Formats acceptés : tous. Plusieurs fichiers possibles.';
    labelChildren.push(
      el('span', { className: 'fr-hint-text' }, hint)
    );

    this._element = el('div', { className: 'fr-upload-group', id: `group-${this.colId}` },
      el('label', { className: 'fr-label', for: inputId }, ...labelChildren),
      this._input,
      el('div', { className: 'fr-messages-group', id: `messages-${this.colId}`, 'aria-live': 'polite' })
    );

    return this._element;
  }

  /**
   * Retourne la liste de fichiers sélectionnés (FileList).
   * L'upload réel est géré par submission.js.
   */
  getValue() {
    const files = this._input?.files;
    return files && files.length > 0 ? Array.from(files) : null;
  }

  reset() {
    if (this._input) this._input.value = '';
  }
}
