import { BaseField } from './base-field.js';
import { el } from '../utils/dom.js';

export class DateTimeField extends BaseField {
  render() {
    const dateId = `input-${this.colId}-date`;
    const timeId = `input-${this.colId}-time`;

    this._dateInput = el('input', {
      className: 'fr-input',
      type: 'date',
      id: dateId,
      name: `${this.colId}_date`,
    });

    this._timeInput = el('input', {
      className: 'fr-input',
      type: 'time',
      id: timeId,
      name: `${this.colId}_time`,
    });

    const labelChildren = [this.label];
    if (this.description) {
      labelChildren.push(
        el('span', { className: 'fr-hint-text' }, this.description)
      );
    }

    this._element = el('div', { id: `group-${this.colId}` },
      el('label', { className: 'fr-label' }, ...labelChildren),
      el('div', { className: 'fr-grid-row fr-grid-row--gutters fr-mt-1w' },
        el('div', { className: 'fr-col-6' },
          el('div', { className: 'fr-input-group' },
            el('label', { className: 'fr-label', for: dateId }, 'Date'),
            this._dateInput
          )
        ),
        el('div', { className: 'fr-col-6' },
          el('div', { className: 'fr-input-group' },
            el('label', { className: 'fr-label', for: timeId }, 'Heure'),
            this._timeInput
          )
        )
      ),
      el('div', { className: 'fr-messages-group', id: `messages-${this.colId}`, 'aria-live': 'polite' })
    );

    return this._element;
  }

  getValue() {
    const date = this._dateInput?.value;
    if (!date) return null;
    return {
      date,
      time: this._timeInput?.value || '00:00',
    };
  }

  validate() {
    const date = this._dateInput?.value;
    if (!date) return { valid: true };
    if (isNaN(new Date(date).getTime())) {
      return { valid: false, message: 'Veuillez entrer une date valide' };
    }
    return { valid: true };
  }

  reset() {
    if (this._dateInput) this._dateInput.value = '';
    if (this._timeInput) this._timeInput.value = '';
  }
}
