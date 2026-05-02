import { $, create, setChildren, textValue, stateMessage, validPhoneDigits, fmtDate, toast, showPrompt } from '../utils.js';
import { api } from '../api.js';
import { MetricCard, StatusBadge, ActionGroup, IconButton, DiffBox } from './components.js';

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

const filters = {
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
    MetricCard('Total', info.total || lastRows.length, { type: 'info' }),
    MetricCard('Critica', info.critica || 0, { type: 'error' }),
    MetricCard('Alta', info.alta || 0, { type: 'warn' }),
    MetricCard('Status Atual', STATUS_LABELS[filters.status] || filters.status, { type: filters.status.toLowerCase() })
  ]);

  document.querySelectorAll('.sav-tab').forEach((button) => {
    const tab = STATUS_TABS.find(([, label]) => label === button.textContent);
    button.classList.toggle('active', tab?.[0] === filters.status);
  });
}

function renderBulkBar(onOpenClient, onOpenWhatsApp) {
  const target = $('sav-bulkbar');
  if (!target) return;

  const selectedRows = lastRows.filter((row) => selectedIds.has(row.id));
  const selectedPending = selectedRows.filter((row) => row.status === 'PENDENTE');
  const allVisibleSelected = lastRows.length > 0 && selectedRows.length === lastRows.length;

  const selectAll = create('input', { className: 'sav-select-all', type: 'checkbox', attrs: { title: 'Selecionar visiveis' } });
  selectAll.checked = allVisibleSelected;
  selectAll.addEventListener('change', () => {
    lastRows.forEach((row) => {
      if (selectAll.checked) selectedIds.add(row.id);
      else selectedIds.delete(row.id);
    });
    renderBulkBar(onOpenClient, onOpenWhatsApp);
    renderRows(onOpenClient, onOpenWhatsApp);
  });

  const approve = IconButton(`Aprovar ${selectedPending.length || ''}`.trim(), () => reviewSelected('APROVADO', onOpenClient, onOpenWhatsApp), {
    className: 'sav-approve-btn',
    disabled: selectedPending.length === 0,
    icon: 'CHECK'
  });

  const reject = IconButton(`Rejeitar ${selectedPending.length || ''}`.trim(), () => reviewSelected('REJEITADO', onOpenClient, onOpenWhatsApp), {
    className: 'sav-reject-btn',
    disabled: selectedPending.length === 0,
    icon: 'X'
  });

  const exportPDF = IconButton('PDF', async () => {
    const ids = Array.from(new Set(selectedRows.map(r => r.idpessoa).filter(Boolean)));
    if (ids.length === 0) return;
    const res = await api.bulkExportClients(ids, 'pdf');
    if (res.error) toast(`Erro: ${res.error}`, 'error');
    else if (!res.canceled) toast('PDF em lote gerado!', 'success');
  }, {
    className: 'sav-export-btn',
    disabled: selectedRows.length === 0,
    icon: 'FILE_TEXT'
  });

  const exportExcel = IconButton('Excel', async () => {
    const ids = Array.from(new Set(selectedRows.map(r => r.idpessoa).filter(Boolean)));
    if (ids.length === 0) return;
    const res = await api.bulkExportClients(ids, 'excel');
    if (res.error) toast(`Erro: ${res.error}`, 'error');
    else if (!res.canceled) toast('Excel em lote gerado!', 'success');
  }, {
    className: 'sav-export-btn',
    disabled: selectedRows.length === 0,
    icon: 'FILE_SPREADSHEET'
  });

  const actionsList = [approve, reject, exportPDF, exportExcel];

  if (filters.prioridade !== 'todas') {
    actionsList.push(IconButton(`Exportar Pri. ${filters.prioridade.toUpperCase()}`, async () => {
      const res = await api.bulkExportByPriority(filters.prioridade, 'pdf');
      if (res.error) toast(`Erro: ${res.error}`, 'error');
      else if (!res.canceled) toast('PDF de prioridade gerado!', 'success');
    }, { className: 'sav-export-btn', icon: 'FILE_TEXT' }));
  }

  setChildren(target, [
    create('label', { className: 'sav-bulk-select' }, [selectAll, create('span', { text: 'Selecionar visiveis' })]),
    create('span', { className: 'sav-bulk-count', text: `${selectedRows.length} selecionada(s)` }),
    ActionGroup(actionsList)
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

  const motivo = decision === 'REJEITADO' ? await showPrompt('Motivo da rejeicao:', '') : '';
  if (decision === 'REJEITADO' && !motivo) {
    if (motivo !== null) toast('Informe um motivo para rejeitar.', 'error');
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
    create('span', { className: 'sav-history-status' }, [
      StatusBadge(item.status_anterior || 'novo', { type: (item.status_anterior || 'info').toLowerCase() }),
      create('span', { text: ' -> ' }),
      StatusBadge(item.status_novo, { type: item.status_novo.toLowerCase() })
    ]),
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
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selectedIds.add(row.id);
    else selectedIds.delete(row.id);
    renderBulkBar(onOpenClient, onOpenWhatsApp);
  });

  const card = create('div', { className: `sav-card ${urgencyClass} status-${status.toLowerCase()}` });
  const actions = [
    IconButton('Abrir', () => onOpenClient?.(row.idpessoa), { className: 'sav-open-btn', icon: 'EXTERNAL_LINK' }),
    IconButton('Hist�rico', () => toggleHistory(row, card), { className: 'sav-history-btn', icon: 'HISTORY' })
  ];

  if (phone) {
    actions.push(IconButton('WhatsApp', () => onOpenWhatsApp?.(phone), { className: 'sav-whatsapp-btn', icon: 'MESSAGE_SQUARE' }));
  }
  if (canReview) {
    actions.push(IconButton('Aprovar', () => reviewSavAction(row, 'APROVADO', onOpenClient, onOpenWhatsApp), { className: 'sav-approve-btn', icon: 'CHECK' }));
    actions.push(IconButton('Rejeitar', () => reviewSavAction(row, 'REJEITADO', onOpenClient, onOpenWhatsApp), { className: 'sav-reject-btn', icon: 'X' }));
  }
  if (canUndo) {
    actions.push(IconButton('Desfazer', () => undoAction(row, onOpenClient, onOpenWhatsApp), { className: 'sav-undo-btn', icon: 'ROTATE_CCW' }));
  }

  const reasons = Array.isArray(row.prioridade_motivos) ? row.prioridade_motivos : [];
  const meta = [
    StatusBadge(urgencyLabel, { type: urgencyClass }),
    StatusBadge(row.tipo_acao || 'ACAO', { type: 'info' }),
    create('span', { text: row.campo || 'campo' }),
    create('span', { text: `${ageHours}h` }),
    row.aniversario_hoje ? StatusBadge('Aniversario hoje', { type: 'success' }) : null,
    row.dias_sem_compra !== undefined ? create('span', { text: `${row.dias_sem_compra}d sem compra` }) : null
  ].filter(Boolean);

  setChildren(card, [
    create('div', { className: 'sav-head' }, [
      create('label', { className: 'sav-check-wrap' }, [checkbox]),
      create('div', { className: 'sav-person', text: textValue(row.nome_pessoa, 'Cliente') }),
      StatusBadge(STATUS_LABELS[status] || status, { type: status.toLowerCase() }),
      create('span', { className: 'sav-priority', text: String(row.prioridade_score || 0) })
    ]),
    create('div', { className: 'sav-meta' }, meta),
    create('div', { className: 'sav-diff' }, [
      DiffBox('Atual', row.valor_atual),
      DiffBox('Anterior', row.valor_anterior),
      DiffBox('Novo', row.valor_novo, { highlight: true })
    ]),
    reasons.length ? create('div', { className: 'sav-priority-reasons' }, reasons.map((reason) => create('span', { text: reason }))) : null,
    create('div', { className: 'sav-motive', text: textValue(row.motivo, 'Sem motivo informado') }),
    ActionGroup(actions)
  ]);

  return card;
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}
