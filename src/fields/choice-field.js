import { BaseField } from './base-field.js';
import { el } from '../utils/dom.js';

const RADIO_THRESHOLD = 7;

export class ChoiceField extends BaseField {
  render() {
    const choices = this.widgetOptions.choices || [];

    if (choices.length <= RADIO_THRESHOLD) {
      return this._renderRadio(choices);
    }
    return this._renderSelect(choices);
  }

  _renderRadio(choices) {
    const fieldsetId = `fieldset-${this.colId}`;
    const legendId = `legend-${this.colId}`;

    const elements = choices.map((choice, i) => {
      const radioId = `radio-${this.colId}-${i}`;
      return el('div', { className: 'fr-fieldset__element' },
        el('div', { className: 'fr-radio-group' },
          el('input', {
            type: 'radio',
            id: radioId,
            name: this.colId,
            value: choice,
          }),
          el('label', { className: 'fr-label', for: radioId }, choice)
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
      role: 'radiogroup',
    },
      el('legend', { className: 'fr-fieldset__legend', id: legendId }, ...legendChildren),
      ...elements,
      el('div', { className: 'fr-messages-group', id: `messages-${this.colId}`, 'aria-live': 'polite' })
    );

    this._mode = 'radio';
    return this._element;
  }

  _renderSelect(choices) {
    const selectId = `input-${this.colId}`;

    const options = [
      el('option', { value: '', selected: true, disabled: true, hidden: true }, 'Sélectionnez une option'),
      ...choices.map(choice =>
        el('option', { value: choice }, choice)
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

    this._mode = 'select';
    return this._element;
  }

  getValue() {
    if (this._mode === 'select') {
      const val = this._select?.value;
      return val || null;
    }
    // Mode radio
    const checked = this._element?.querySelector(`input[name="${this.colId}"]:checked`);
    return checked?.value || null;
  }

  reset() {
    if (this._mode === 'select' && this._select) {
      this._select.selectedIndex = 0;
    } else if (this._element) {
      const radios = this._element.querySelectorAll(`input[name="${this.colId}"]`);
      radios.forEach(r => r.checked = false);
    }
  }
}
