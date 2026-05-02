export function $(id) {
  return document.getElementById(id);
}

export function textValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

export function create(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  if (options.id) element.id = options.id;
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.innerHTML !== undefined) element.innerHTML = options.innerHTML;
  if (options.title) element.title = options.title;
  if (options.type) element.type = options.type;
  if (options.value !== undefined) element.value = options.value;
  if (options.placeholder !== undefined) element.placeholder = options.placeholder;
  if (options.checked !== undefined) element.checked = !!options.checked;
  if (options.disabled !== undefined) element.disabled = !!options.disabled;
  if (options.hidden !== undefined) element.hidden = options.hidden;
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      element.dataset[key] = (value === null || value === undefined) ? '' : String(value);
    });
  }
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  if (options.onClick) element.addEventListener('click', options.onClick);
  if (options.onclick) element.addEventListener('click', options.onclick);
  if (options.onInput) element.addEventListener('input', options.onInput);
  if (options.oninput) element.addEventListener('input', options.oninput);
  if (options.onChange) element.addEventListener('change', options.onChange);
  if (options.onchange) element.addEventListener('change', options.onchange);
  appendChildren(element, children);
  return element;
}

export function appendChildren(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  list.forEach((child) => {
    if (child === null || child === undefined) return;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
}

export function setChildren(parent, children = []) {
  parent.replaceChildren();
  appendChildren(parent, children);
}

export function stateMessage(text, type = '') {
  return create('div', { className: `state-message ${type}`.trim(), text });
}

/**
 * @deprecated Use StatusBadge from components.js instead.
 */
export function badge(text, className = '') {
  return create('span', { className: `result-badge ${className}`.trim(), text });
}

export function fmtPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits[2]} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

export function onlyDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

export function validPhoneDigits(raw) {
  const digits = onlyDigits(raw);
  return digits.length >= 10 && digits.length <= 13 ? digits : '';
}

export function phoneDisplay(raw) {
  const digits = validPhoneDigits(raw);
  return digits ? fmtPhone(digits) : '';
}

export function parseDateParts(dateLike) {
  if (!dateLike) return null;
  if (dateLike instanceof Date && !Number.isNaN(dateLike.getTime())) {
    return { year: dateLike.getFullYear(), month: dateLike.getMonth() + 1, day: dateLike.getDate() };
  }
  const text = String(dateLike);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return null;
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function rawDate(dateLike) {
  const parts = parseDateParts(dateLike);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function fmtDate(dateLike) {
  const parts = parseDateParts(dateLike);
  if (!parts) return '-';
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function fmtMoney(value) {
  return parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toast(message, type = 'info', duration = 3000) {
  const container = $('toast-container') || create('div', { id: 'toast-container' });
  if (!container.parentElement) document.body.appendChild(container);

  const el = create('div', { className: `toast toast-${type}`, text: message });
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 500);
  }, duration);
}

/**
 * Custom prompt for Electron environment.
 * Replaces window.prompt which is not supported.
 */
export async function showPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = create('div', { className: 'dialog-overlay' });
    const dialog = create('div', { className: 'dialog-box' }, [
      create('div', { className: 'dialog-message', text: message }),
      create('input', { className: 'dialog-input', value: defaultValue, id: 'dialog-prompt-input' }),
      create('div', { className: 'dialog-actions' }, [
        create('button', { className: 'dialog-btn cancel', text: 'Cancelar', onClick: () => close(null) }),
        create('button', { className: 'dialog-btn confirm', text: 'OK', onClick: () => close(document.getElementById('dialog-prompt-input').value) })
      ])
    ]);

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    const input = dialog.querySelector('input');
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
  });
}
