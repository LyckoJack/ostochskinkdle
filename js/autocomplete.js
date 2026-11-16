// Tillgänglig autocomplete (ARIA combobox-mönstret) med tangentbordsnavigering.
import { suggest } from './match.js';

/**
 * @param {object} opts
 * @param {HTMLInputElement} opts.input
 * @param {HTMLUListElement} opts.list
 * @param {() => object[]} opts.getIndex
 * @param {() => Set<string>} opts.getExcluded  id:n som redan gissats
 * @param {(dish: object) => void} opts.onPick   anropas när ett förslag väljs
 */
export function createAutocomplete({ input, list, getIndex, getExcluded, onPick }) {
  let items = [];
  let active = -1;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  list.setAttribute('role', 'listbox');

  function close() {
    items = [];
    active = -1;
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function setActive(i) {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) {
      const li = list.children[i];
      input.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function render() {
    items = suggest(getIndex(), input.value, { exclude: getExcluded() });
    list.replaceChildren();
    if (!items.length) {
      close();
      return;
    }
    items.forEach(({ dish, via }, i) => {
      const li = document.createElement('li');
      li.id = `opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.className = 'ac-option';
      const name = document.createElement('span');
      name.textContent = dish.name;
      li.append(name);
      if (via) {
        const alias = document.createElement('span');
        alias.className = 'ac-alias';
        alias.textContent = `”${via}”`;
        li.append(alias);
      }
      // mousedown istället för click så att inputen inte tappar fokus först
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(i);
      });
      list.append(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  }

  function pick(i) {
    const item = items[i];
    if (!item) return;
    input.value = item.dish.name;
    close();
    onPick?.(item.dish);
  }

  input.addEventListener('input', render);
  input.addEventListener('blur', () => setTimeout(close, 100));
  input.addEventListener('keydown', (e) => {
    const open = !list.hidden && items.length > 0;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) render();
        else setActive((active + 1) % items.length);
        break;
      case 'ArrowUp':
        if (!open) return;
        e.preventDefault();
        setActive(active <= 0 ? items.length - 1 : active - 1);
        break;
      case 'Enter':
        if (open && active >= 0) {
          e.preventDefault(); // välj förslaget, nästa Enter skickar
          pick(active);
        } else if (open && items.length === 1) {
          pick(0); // bara ett förslag: fyll i och låt formuläret skickas
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case 'Tab':
        if (open && active >= 0) pick(active);
        break;
    }
  });

  return { close, refresh: render };
}
