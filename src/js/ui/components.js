import { create, textValue, phoneDisplay, fmtDate } from '../utils.js';
import { ICONS } from './icons.js';

/**
 * UI Component Library
 * Standardizes design patterns across the application.
 */

export function card(options = {}, children = []) {
  return create('div', { 
    className: `ui-card ${options.className || ''}`.trim(),
    onClick: options.onClick
  }, children);
}

/**
 * Standardized metric box
 * @param {string} label 
 * @param {string|number} value 
 * @param {object} options { type: 'success'|'warn'|'info'|'error', subValue: string }
 */
export function MetricCard(label, value, options = {}) {
  const typeClass = options.type ? `metric-${options.type}` : '';
  return create('div', { className: `metric-card ${typeClass}`.trim() }, [
    create('div', { className: 'metric-label', text: label }),
    create('div', { className: 'metric-value', text: value }),
    options.subValue ? create('div', { className: 'metric-sub', text: options.subValue }) : null
  ].filter(Boolean));
}

/**
 * A robust, themed badge component.
 * Replaces legacy badge implementation.
 */
export function StatusBadge(text, options = {}) {
  const type = options.type || 'info';
  const typeMap = {
    // Basic types
    success: 'badge-success',
    warn: 'badge-warn',
    warning: 'badge-warn',
    error: 'badge-error',
    info: 'badge-info',
    priority: 'badge-priority',
    // SAV Status types (rounded pills)
    pendente: 'sav-status-pendente',
    aprovado: 'sav-status-aprovado',
    rejeitado: 'sav-status-rejeitado',
    concluido: 'sav-status-concluido',
    // SAV Chip types (border + color)
    critical: 'sav-chip-critical',
    high: 'sav-chip-high'
  };

  const className = typeMap[type] || type;
  
  // Decide base class based on prefix or explicit type
  let baseClass = 'result-badge';
  if (type.startsWith('sav-status') || ['pendente', 'aprovado', 'rejeitado', 'concluido'].includes(type)) {
    baseClass = 'sav-status';
  } else if (type.startsWith('sav-chip') || ['critical', 'high'].includes(type)) {
    baseClass = 'sav-chip';
  }

  return create('span', { 
    className: `${baseClass} ${className}`.trim(), 
    title: options.title,
    text 
  });
}

/**
 * Flexbox container for buttons to ensure consistent spacing.
 */
export function ActionGroup(children, options = {}) {
  return create('div', { className: `sav-actions ${options.className || ''}`.trim() }, children);
}

/**
 * Standardized button component.
 */
export function IconButton(text, onClick, options = {}) {
  const children = [];
  
  if (options.icon && ICONS[options.icon]) {
    children.push(create('span', { 
      className: 'btn-icon',
      innerHTML: ICONS[options.icon]
    }));
  }
  
  if (text) {
    children.push(create('span', { className: 'btn-text', text }));
  }

  return create('button', {
    className: `ui-icon-btn ${options.className || ''}`.trim(),
    type: options.type || 'button',
    disabled: options.disabled,
    title: options.title,
    onClick
  }, children);
}

/**
 * Reusable component for comparing values.
 */
export function DiffBox(label, value, options = {}) {
  return create('div', { 
    className: `sav-diff-box ${options.highlight ? 'sav-diff-new' : ''}`.trim() 
  }, [
    create('span', { className: 'sav-diff-label', text: label }),
    create('span', { className: 'sav-diff-value', text: textValue(value, 'vazio') })
  ]);
}

export function renderSearchResult(row, onOpen) {
  const badges = [];
  if (row.sttipopessoa === 'C') badges.push(StatusBadge('Cliente', { type: 'success' }));
  if (row.sttipopessoa === 'F') badges.push(StatusBadge('Fornecedor', { type: 'info' }));
  if (row.stvendedor) badges.push(StatusBadge('Vendedor', { type: 'warning' }));
  if (row._source === 'cache') badges.push(StatusBadge('Cache', { type: 'priority' }));

  const info = [
    row.nrcgc_cic ? `Doc: ${row.nrcgc_cic}` : '',
    row.dtdatanasc ? `Nasc: ${fmtDate(row.dtdatanasc)}` : '',
    phoneDisplay(row.campostelwhatsapp) ? `WhatsApp: ${phoneDisplay(row.campostelwhatsapp)}` : '',
    row.email ? `Email: ${row.email}` : ''
  ].filter(Boolean);

  return create('button', {
    className: 'result-item ui-interactive',
    type: 'button',
    onClick: () => onOpen(row.idpessoa)
  }, [
    create('div', { className: 'result-name' }, [
      create('span', { className: 'btn-icon', innerHTML: ICONS.USERS }),
      create('span', { text: '👤 ' + textValue(row.nmpessoa, 'Cliente sem nome') }),
      ...badges
    ]),
    create('div', { className: 'result-info' }, info.map((item) => create('span', { text: item })))
  ]);
}

export function renderPurchaseRow(row) {
  return create('div', { className: 'purchase-row' }, [
    create('span', { className: 'pr-date', text: fmtDate(row.dtemissao) }),
    create('span', { className: 'pr-nf', text: row.nrnotafiscal ? `NF ${row.nrnotafiscal}` : '' }),
    create('span', { className: 'pr-value', text: `R$ ${row.vltotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` })
  ]);
}
