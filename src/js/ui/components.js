import { create, badge as baseBadge, textValue, phoneDisplay, fmtDate } from '../utils.js';

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

export function badge(text, type = 'info') {
  const typeMap = {
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warn',
    error: 'badge-error',
    priority: 'badge-priority'
  };
  return baseBadge(text, typeMap[type] || type);
}

export function renderSearchResult(row, onOpen) {
  const badges = [];
  if (row.sttipopessoa === 'C') badges.push(badge('Cliente', 'success'));
  if (row.sttipopessoa === 'F') badges.push(badge('Fornecedor', 'info'));
  if (row.stvendedor) badges.push(badge('Vendedor', 'warning'));
  if (row._source === 'cache') badges.push(badge('Cache', 'priority'));

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
      create('span', { text: textValue(row.nmpessoa, 'Cliente sem nome') }),
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
