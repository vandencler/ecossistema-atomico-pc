import { $, create, setChildren, stateMessage, toast } from '../utils.js';
import { api } from '../api.js';
import { renderClientHeader, renderClientStats, renderCadastro } from '../ui/clientes.js';
import { getCurrentClient, backToSearch, renderWhatsApp } from './dashboard.js';

const HEADER_FIELDS = new Set(['nmpessoa', 'nmcurto', 'nrpager', 'nrtelefone', 'campostelwhatsapp', 'email', 'dtdatanasc', 'sexo', 'idtabela']);

export function setupCorrections() {
  $('tab-cadastro')?.addEventListener('click', handleEditClick);
}

function handleEditClick(event) {
  const editButton = event.target.closest('.cf-edit');
  const currentClient = getCurrentClient();
  if (!editButton || !currentClient) return;

  const campo = editButton.dataset.campo;
  const tabela = editButton.dataset.tabela;
  const rawVal = editButton.dataset.raw || '';
  const selectType = editButton.dataset.type || '';
  const row = editButton.closest('.cadastro-field');
  const wrap = row.querySelector('.cf-value-wrap');
  if (!wrap || wrap.querySelector('.cf-edit-input') || wrap.querySelector('.cf-edit-select')) return;

  const cancel = () => renderCadastro(currentClient.profile, currentClient.corrections || {}, currentClient.actionStatus || {});
  const controlButton = (text, className, onClick) => create('button', { className, type: 'button', text, onClick });
  const saveButton = controlButton('OK', 'cf-save', null);
  const cancelButton = controlButton('Cancelar', 'cf-cancel', cancel);
  setChildren(wrap, []);

  if (selectType === 'select-tabela') {
    const select = create('select', { className: 'cf-edit-select' }, create('option', { value: '', text: 'Carregando...' }));
    setChildren(wrap, [select, saveButton, cancelButton]);

    api.getTabelasPreco().then((data) => {
      if (data.error || !Array.isArray(data.rows)) {
        setChildren(wrap, [stateMessage(data.error || 'Falha ao carregar tabelas', 'error'), cancelButton]);
        return;
      }
      populateSelect(select, data.rows, rawVal, 'idtabela', 'dstabela');
    });

    saveButton.addEventListener('click', async () => {
      const newId = select.value;
      const newName = select.options[select.selectedIndex]?.text || '';
      if (newId === rawVal) return cancel();
      const ok = await saveCorrection({ campo, valorOriginal: rawVal, valorNovo: newId, tabelaOrigem: tabela });
      if (!ok) return;
      currentClient.corrections = currentClient.corrections || {};
      currentClient.corrections[campo] = newId;
      currentClient.profile[campo] = newId;
      currentClient.profile.tabela_preco = newName;
      markPending(currentClient, campo);
      renderCadastro(currentClient.profile, currentClient.corrections, currentClient.actionStatus);
      renderClientHeader(currentClient.profile, currentClient.ranking, backToSearch, currentClient.priority);
    });
    return;
  }

  if (selectType === 'select-convenio') {
    const select = create('select', { className: 'cf-edit-select' }, create('option', { value: '', text: 'Carregando...' }));
    setChildren(wrap, [select, saveButton, cancelButton]);

    api.getConvenios().then((data) => {
      if (data.error || !Array.isArray(data.rows)) {
        setChildren(wrap, [stateMessage(data.error || 'Falha ao carregar convenios', 'error'), cancelButton]);
        return;
      }
      populateSelect(select, data.rows, rawVal, 'idpessoa', 'nmpessoa', true);
    });

    saveButton.addEventListener('click', async () => {
      const newId = select.value;
      const newName = newId ? (select.options[select.selectedIndex]?.text || '') : '';
      if (newId === rawVal) return cancel();
      const ok = await saveCorrection({
        motivo: 'Correcao de convenio',
        changes: [
          { campo: 'convenio_terapeuta', valorOriginal: rawVal, valorNovo: newId, tabelaOrigem: 'ecossistema' },
          { campo: 'convenio_terapeuta_nome', valorOriginal: currentClient.corrections?.convenio_terapeuta_nome || '', valorNovo: newName, tabelaOrigem: 'ecossistema', enfileirar: false }
        ]
      });
      if (!ok) return;
      currentClient.corrections = currentClient.corrections || {};
      currentClient.corrections.convenio_terapeuta = newId;
      currentClient.corrections.convenio_terapeuta_nome = newName;
      markPending(currentClient, 'convenio_terapeuta');
      renderCadastro(currentClient.profile, currentClient.corrections, currentClient.actionStatus);
    });
    return;
  }

  const inputType = campo === 'dtdatanasc' ? 'date' : 'text';
  const input = create('input', { className: 'cf-edit-input', type: inputType, value: rawVal });
  setChildren(wrap, [input, saveButton, cancelButton]);
  input.focus();
  input.select();

  const doSave = async () => {
    const valorNovo = input.value.trim();
    if (valorNovo === rawVal) return cancel();
    const ok = await saveCorrection({ campo, valorOriginal: rawVal, valorNovo, tabelaOrigem: tabela });
    if (!ok) return;
    currentClient.corrections = currentClient.corrections || {};
    currentClient.corrections[campo] = valorNovo;
    currentClient.profile[campo] = valorNovo;
    markPending(currentClient, campo);
    renderCadastro(currentClient.profile, currentClient.corrections, currentClient.actionStatus);
    if (HEADER_FIELDS.has(campo)) {
      renderClientHeader(currentClient.profile, currentClient.ranking, backToSearch, currentClient.priority);
      renderClientStats(currentClient.stats, currentClient.ranking, currentClient.profile);
      renderWhatsApp(currentClient.profile);
    }
  };

  saveButton.addEventListener('click', doSave);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') doSave();
    if (ev.key === 'Escape') cancel();
  });
}

function markPending(currentClient, campo) {
  currentClient.actionStatus = currentClient.actionStatus || {};
  currentClient.actionStatus[campo] = { status: 'PENDENTE' };
}

async function saveCorrection(payload) {
  const currentClient = getCurrentClient();
  const result = await api.saveCorrection({
    ...payload,
    idpessoa: currentClient.profile.idpessoa,
    nomePessoa: currentClient.profile.nmpessoa || ''
  });
  if (result.error) {
    toast(`Erro: ${result.error}`, 'error');
    return false;
  }
  
  if (result.buffered) {
    toast('Salvo offline (será sincronizado em breve)', 'info');
  } else {
    toast('Alteração salva com sucesso!', 'success');
  }
  return true;
}

function populateSelect(select, rows, selectedValue, valueKey, labelKey, includeEmpty = false) {
  const options = [];
  if (includeEmpty) options.push(create('option', { value: '', text: '(nenhum)' }));
  rows.forEach((row) => {
    const value = String(row[valueKey] ?? '');
    const text = row[labelKey] || value;
    const option = create('option', { value, text });
    if (value === String(selectedValue || '')) option.selected = true;
    options.push(option);
  });
  setChildren(select, options);
}
