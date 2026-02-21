/**
 * Helpers pour la création d'éléments DOM.
 */

let counter = 0;

/**
 * Génère un ID unique pour les éléments de formulaire.
 */
export function uniqueId(prefix = 'field') {
  return `${prefix}-${++counter}`;
}

/**
 * Crée un élément DOM avec des attributs et des enfants.
 * @param {string} tag - Nom de la balise HTML
 * @param {Object} attrs - Attributs (className, id, type, etc.)
 * @param  {...(Node|string)} children - Enfants (éléments ou texte)
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.assign(element.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined && value !== false) {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (Array.isArray(child)) {
      child.forEach(c => c && element.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    } else {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * Crée un groupe d'input DSFR standard (label + input + messages).
 */
export function createInputGroup(colId, label, description, inputElement) {
  const groupId = `group-${colId}`;
  const messagesId = `messages-${colId}`;

  const labelChildren = [label];
  if (description) {
    labelChildren.push(
      el('span', { className: 'fr-hint-text' }, description)
    );
  }

  return el('div', { className: 'fr-input-group', id: groupId },
    el('label', { className: 'fr-label', for: inputElement.id }, ...labelChildren),
    inputElement,
    el('div', { className: 'fr-messages-group', id: messagesId, 'aria-live': 'polite' })
  );
}

/**
 * Affiche une erreur sur un groupe de champ DSFR.
 */
export function setFieldError(colId, message) {
  const group = document.getElementById(`group-${colId}`);
  const messages = document.getElementById(`messages-${colId}`);
  const input = document.getElementById(`input-${colId}`);

  if (group) {
    group.classList.add('fr-input-group--error');
    group.classList.remove('fr-input-group--valid');
  }
  if (input) {
    input.classList.add('fr-input--error');
    input.classList.remove('fr-input--valid');
    input.setAttribute('aria-invalid', 'true');
  }
  if (messages) {
    messages.innerHTML = '';
    messages.appendChild(
      el('p', { className: 'fr-error-text', id: `error-${colId}` }, message)
    );
    if (input) input.setAttribute('aria-describedby', `error-${colId}`);
  }
}

/**
 * Efface l'erreur d'un groupe de champ DSFR.
 */
export function clearFieldError(colId) {
  const group = document.getElementById(`group-${colId}`);
  const messages = document.getElementById(`messages-${colId}`);
  const input = document.getElementById(`input-${colId}`);

  if (group) {
    group.classList.remove('fr-input-group--error');
  }
  if (input) {
    input.classList.remove('fr-input--error');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
  if (messages) {
    messages.innerHTML = '';
  }
}
