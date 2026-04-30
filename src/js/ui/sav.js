import { $, create, setChildren, textValue, stateMessage, validPhoneDigits, fmtDate, toast } from '../utils.js';
import { api } from '../api.js';

const STATUS_TABS = [
  ['PENDENTE', 'Pendentes'],
  ['APROVADO', 'Aprovadas'],
  ['REJEITADO', 'Rejeitadas'],
  ['CONCLUIDO', 'Concluidas'],
  ['ERRO', 'Erro'],
  ['TODOS', 'Todos']
];

const STATUS_LABELS = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovada',
  REJEITADO: 'Rejeitada',
  EM_EXECUCAO: 'Executando',
  CONCLUIDO: 'Concluida',
  ERRO: 'Erro',
  CANCELADO: 'Cancelada'
};

let filters = {
  status: 'PENDENTE',
  search: '',
  campo: '',
  prioridade: 'todas'
};

let selectedIds = new Set();
let lastRows = [];
let callbacks = {};

export async function loadSavQueue(onOpenClient, onOpenWhatsApp) {
  callbacks = {
    onOpenClient: onOpenClient || callbacks.onOpenClient,
    onOpenWhatsApp: onOpenWhatsApp || callbacks.onOpenWhatsApp
  };

  const list = $('sav-list');
  const summary = $('sav-summary');
  if (!list || !summary) return;

  ensureSavControls(onOpenClient, onOpenWhatsApp);
  setChildren(list, stateMessage('Atualizando fila...', 'muted'));
  setChildren(summary, []);

  const data = await api.savActionQueue(filters);
  if (data.error) {
    setChildren(list, stateMessage(`Erro: ${data.error}`, 'error'));
    return;
  }

  lastRows = data.rows || [];
  selectedIds = new Set([...selectedIds].filter((id) => lastRows.some((row) => row.id === id)));
  renderSummary(data.summary || {});
  renderBulkBar(onOpenClient, onOpenWhatsApp);

  if (lastRows.length === 0) {
    setChildren(list, stateMessage('Sem pendencias para os filtros atuais.', 'muted'));
    return;
  }

  setChildren(list, lastRows.map((row) => renderSavCard(row, onOpenClient, onOpenWhatsApp)));
}

function ensureSavControls(onOpenClient, onOpenWhatsApp) {
  const module = $('mod-sav');
  const summary = $('sav-summary');
  if (!module || !summary || $('sav-tabs')) return;

  const tabs = create('div', { id: 'sav-tabs', className: 'sav-tabs' }, STATUS_TABS.map(([status, label]) => create('button', {
    className: status === filters.status ? 'sav-tab active' : 'sav-tab',
    type: 'button',
    text: label,
    onClick: () => {
      filters.status = status;
      selectedIds.clear();
      loadSavQueue(onOpenClient, onOpenWhatsApp);
    }
  })));

  const search = create('input', {
    className: 'sav-filter-input',
    type: 'search',
    value: filters.search,
    attrs: { placeholder: 'Buscar cliente, ID ou campo' }
  });
  search.addEventListener('input', debounce(() => {
    filters.search = search.value.trim();
    loadSavQueue(onOpenClient, onOpenWhatsApp);
  }, 250));

  const field = create('input', {
    className: 'sav-filter-input sav-filter-field',
    type: 'search',
    value: filters.campo,
    attrs: { placeholder: 'Campo' }
  });
  field.addEventListener('input', debounce(() => {
    filters.campo = field.value.trim();
    loadSavQueue(onOpenClient, onOpenWhatsApp);
  }, 250));

  const priority = create('select', { className: 'sav-filter-select' }, [
    create('option', { value: 'todas', text: 'Prioridade: todas' }),
    create('option', { value: 'critica', text: 'Critica' }),
    create('option', { value: 'alta', text: 'Alta' }),
    create('option', { value: 'normal', text: 'Normal' })
  ]);
  priority.value = filters.prioridade;
  priority.addEventListener('change', () => {
    filters.prioridade = priority.value;
    loadSavQueue(onOpenClient, onOpenWhatsApp);
  });

  const filtersBar = create('div', { id: 'sav-filters', className: 'sav-filters' }, [search, field, priority]);
  const bulkBar = create('div', { id: 'sav-bulkbar', className: 'sav-bulkbar' });

  module.insertBefore(tabs, summary);
  module.insertBefore(filtersBar, summary);
  module.insertBefore(bulkBar, summary.nextSibling);
}

function renderSummary(info) {
  const summary = $('sav-summary');
  setChildren(summary, [
    create('span', { className: 'sav-chip', text: `Total: ${info.total || lastRows.length}` }),
    create('span', { className: 'sav-chip sav-chip-critical', text: `Critica: ${info.critica || 0}` }),
    create('span', { className: 'sav-chip sav-chip-high', text: `Alta: ${info.alta || 0}` }),
    create('span', { className: 'sav-chip', text: `Status: ${STATUS_LABELS[filters.status] || filters.status}` })
  ]);

  document.querySelectorAll('.sav-tab').forEach((button) => {
    const tab = STATUS_TABS.find(([, label]) => label === button.textContent);
    button.classList.toggle('active', tab?.[0] === filters.status);
  });
}

function renderBulkBar(onOpenClient, onOpenWhatsApp) {
  const target = $('sav-bulkbar');
  if (!target) return;

  const pendingRows = lastRows.filter((row) => row.status === 'PENDENTE');
  const selectedPending = pendingRows.filter((row) => selectedIds.has(row.id));
  const allVisibleSelected = pendingRows.length > 0 && selectedPending.length === pendingRows.length;

  const selectAll = create('input', { className: 'sav-select-all', type: 'checkbox', attrs: { title: 'Selecionar pendentes visiveis' } });
  selectAll.checked = allVisibleSelected;
  selectAll.addEventListener('change', () => {
    pendingRows.forEach((row) => {
      if (selectAll.checked) selectedIds.add(row.id);
      else selectedIds.delete(row.id);
    });
    renderBulkBar(onOpenClient, onOpenWhatsApp);
    renderRows(onOpenClient, onOpenWhatsApp);
  });

  const approve = create('button', {
    className: 'sav-approve-btn',
    type: 'button',
    text: `Aprovar ${selectedPending.length || ''}`.trim(),
    onClick: () => reviewSelected('APROVADO', onOpenClient, onOpenWhatsApp)
  });
  approve.disabled = selectedPending.length === 0;

  const reject = create('button', {
    className: 'sav-reject-btn',
    type: 'button',
    text: `Rejeitar ${selectedPending.length || ''}`.trim(),
    onClick: () => reviewSelected('REJEITADO', onOpenClient, onOpenWhatsApp)
  });
  reject.disabled = selectedPending.length === 0;

  setChildren(target, [
    create('label', { className: 'sav-bulk-select' }, [selectAll, create('span', { text: 'Selecionar pendentes' })]),
    create('span', { className: 'sav-bulk-count', text: `${selectedPending.length} selecionada(s)` }),
    approve,
    reject
  ]);
}

function renderRows(onOpenClient, onOpenWhatsApp) {
  const list = $('sav-list');
  if (!list) return;
  setChildren(list, lastRows.length
    ? lastRows.map((row) => renderSavCard(row, onOpenClient, onOpenWhatsApp))
    : stateMessage('Sem pendencias para os filtros atuais.', 'muted'));
}

async function reviewSelected(decision, onOpenClient, onOpenWhatsApp) {
  const ids = lastRows
    .filter((row) => row.status === 'PENDENTE' && selectedIds.has(row.id))
    .map((row) => row.id);
  if (ids.length === 0) return;

  const motivo = decision === 'REJEITADO' ? window.prompt('Motivo da rejeicao:', '') : '';
  if (decision === 'REJEITADO' && !motivo) {
    toast('Informe um motivo para rejeitar.', 'error');
    return;
  }

  const confirmed = window.confirm(
    decision === 'APROVADO'
      ? `Aprovar ${ids.length} acao(oes) para execucao futura?`
      : `Rejeitar ${ids.length} acao(oes)?`
  );
  if (!confirmed) return;

  const result = await api.reviewSavActions({
    ids,
    decision,
    motivo: motivo || '',
    usuario: 'gestor-sav'
  });

  if (result.error) {
    toast(`Erro: ${result.error}`, 'error');
    return;
  }

  selectedIds.clear();
  toast(decision === 'APROVADO' ? 'Acoes aprovadas.' : 'Acoes rejeitadas.', 'success');
  await loadSavQueue(onOpenClient, onOpenWhatsApp);
}

async function reviewSavAction(row, decision, onOpenClient, onOpenWhatsApp) {
  selectedIds = new Set([row.id]);
  await reviewSelected(decision, onOpenClient, onOpenWhatsApp);
}

async function undoAction(row, onOpenClient, onOpenWhatsApp) {
  const confirmed = window.confirm('Voltar esta acao para PENDENTE?');
  if (!confirmed) return;

  const result = await api.undoSavAction({
    id: row.id,
    usuario: 'gestor-sav',
    motivo: 'Revisao desfeita pela central SAV'
  });
  if (result.error) {
    toast(`Erro: ${result.error}`, 'error');
    return;
  }
  toast('Acao voltou para pendente.', 'success');
  await loadSavQueue(onOpenClient, onOpenWhatsApp);
}

async function toggleHistory(row, card) {
  const existing = card.querySelector('.sav-history');
  if (existing) {
    existing.remove();
    return;
  }

  const history = create('div', { className: 'sav-history' }, stateMessage('Carregando historico...', 'muted'));
  card.appendChild(history);

  const data = await api.savActionHistory({ id: row.id });
  if (data.error) {
    setChildren(history, stateMessage(`Erro: ${data.error}`, 'error'));
    return;
  }

  const rows = data.rows || [];
  if (rows.length === 0) {
    setChildren(history, stateMessage('Sem historico registrado.', 'muted'));
    return;
  }

  setChildren(history, rows.map((item) => create('div', { className: 'sav-history-row' }, [
    create('span', { className: 'sav-history-date', text: fmtDate(item.criado_em) }),
    create('span', { className: 'sav-history-status', text: `${item.status_anterior || 'novo'} -> ${item.status_novo}` }),
    create('span', { className: 'sav-history-user', text: textValue(item.usuario, 'sistema') }),
    item.motivo ? create('span', { className: 'sav-history-reason', text: item.motivo }) : null
  ])));
}

function renderSavCard(row, onOpenClient, onOpenWhatsApp) {
  const phone = validPhoneDigits(row.campostelwhatsapp) || validPhoneDigits(row.nrpager) || validPhoneDigits(row.nrtelefone);
  const status = row.status || 'PENDENTE';
  const ageHours = Math.max(0, Math.floor((Date.now() - new Date(row.criado_em).getTime()) / 3600000));
  const urgencyClass = row.prioridade_bucket || (row.prioridade_score >= 80 ? 'critica' : row.prioridade_score >= 60 ? 'alta' : 'normal');
  const urgencyLabel = urgencyClass === 'critica' ? 'Critica' : urgencyClass === 'alta' ? 'Alta' : 'Normal';
  const canReview = status === 'PENDENTE';
  const canUndo = status === 'APROVADO' || status === 'REJEITADO';

  const checkbox = create('input', {
    className: 'sav-row-check',
    type: 'checkbox',
    attrs: { title: 'Selecionar para acao em lote' }
  });
  checkbox.checked = selectedIds.has(row.id);
  checkbox.disabled = !canReview;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selectedIds.add(row.id);
    else selectedIds.delete(row.id);
    renderBulkBar(onOpenClient, onOpenWhatsApp);
  });

  const card = create('div', { className: `sav-card ${urgencyClass} status-${status.toLowerCase()}` });
  const actions = [
    create('button', { className: 'sav-open-btn', type: 'button', text: 'Abrir', onClick: () => onOpenClient?.(row.idpessoa) }),
    create('button', { className: 'sav-history-btn', type: 'button', text: 'Historico', onClick: () => toggleHistory(row, card) })
  ];

  if (phone) {
    actions.push(create('button', { className: 'sav-whatsapp-btn', type: 'button', text: 'WhatsApp', onClick: () => onOpenWhatsApp?.(phone) }));
  }
  if (canReview) {
    actions.push(create('button', { className: 'sav-approve-btn', type: 'button', text: 'Aprovar', onClick: () => reviewSavAction(row, 'APROVADO', onOpenClient, onOpenWhatsApp) }));
    actions.push(create('button', { className: 'sav-reject-btn', type: 'button', text: 'Rejeitar', onClick: () => reviewSavAction(row, 'REJEITADO', onOpenClient, onOpenWhatsApp) }));
  }
  if (canUndo) {
    actions.push(create('button', { className: 'sav-undo-btn', type: 'button', text: 'Desfazer', onClick: () => undoAction(row, onOpenClient, onOpenWhatsApp) }));
  }

  const reasons = Array.isArray(row.prioridade_motivos) ? row.prioridade_motivos : [];
  const meta = [
    urgencyLabel,
    row.tipo_acao || 'ACAO',
    row.campo || 'campo',
    `${ageHours}h`,
    row.aniversario_hoje ? 'Aniversario hoje' : '',
    row.dias_sem_compra !== undefined ? `${row.dias_sem_compra}d sem compra` : ''
  ].filter(Boolean);

  setChildren(card, [
    create('div', { className: 'sav-head' }, [
      create('label', { className: 'sav-check-wrap' }, [checkbox]),
      create('div', { className: 'sav-person', text: textValue(row.nome_pessoa, 'Cliente') }),
      create('span', { className: `sav-status sav-status-${status.toLowerCase()}`, text: STATUS_LABELS[status] || status }),
      create('span', { className: 'sav-priority', text: String(row.prioridade_score || 0) })
    ]),
    create('div', { className: 'sav-meta' }, meta.map((item) => create('span', { text: item }))),
    create('div', { className: 'sav-diff' }, [
      diffBox('Atual', row.valor_atual),
      diffBox('Anterior', row.valor_anterior),
      diffBox('Novo', row.valor_novo, true)
    ]),
    reasons.length ? create('div', { className: 'sav-priority-reasons' }, reasons.map((reason) => create('span', { text: reason }))) : null,
    create('div', { className: 'sav-motive', text: textValue(row.motivo, 'Sem motivo informado') }),
    create('div', { className: 'sav-actions' }, actions)
  ]);

  return card;
}

function diffBox(label, value, highlight = false) {
  return create('div', { className: highlight ? 'sav-diff-box sav-diff-new' : 'sav-diff-box' }, [
    create('span', { className: 'sav-diff-label', text: label }),
    create('span', { className: 'sav-diff-value', text: textValue(value, 'vazio') })
  ]);
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}
