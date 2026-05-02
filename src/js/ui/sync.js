import { MetricCard } from './components.js';
import { $, create, setChildren, stateMessage, toast } from '../utils.js';
import { api } from '../api.js';

export async function loadSyncModule() {
  const list = $('sync-list');
  const summary = $('sync-summary');
  const actions = $('sync-actions');
  if (!list || !summary || !actions) return;

  setChildren(list, stateMessage('Verificando divergencias...', 'muted'));
    setChildren(summary, [
    MetricCard('Aprovadas', total, { type: 'info' }),
    MetricCard('Divergentes', divergent, { type: divergent > 0 ? 'warn' : 'success' }),
    readyToExport > 0 ? MetricCard('Aguardando ERP', readyToExport, { type: 'info' }) : null,
    blocked ? MetricCard('Bloqueadas', blocked, { type: 'error' }) : null
  ].filter(Boolean));
  setChildren(actions, []);
  actions.hidden = true;

  const data = await api.getSyncStatus();
  if (data.error) {
    setChildren(list, stateMessage(`Erro: ${data.error}`, 'error'));
    return;
  }

  const items = data.items || [];
  const total = data.totalPending || 0;
  const readyToExport = data.readyToExport || 0;
  const divergent = items.filter((item) => item.needsSync).length;
  const blocked = items.filter((item) => item.blocked).length;

  setChildren(summary, [
    create('span', { className: 'sync-chip', text: `Aprovadas: ${total}` }),
    create('span', { className: `sync-chip ${divergent > 0 ? 'sync-chip-warn' : ''}`, text: `Divergentes: ${divergent}` }),
    readyToExport > 0 ? create('span', { className: 'sync-chip sync-chip-info', text: `Aguardando ERP: ${readyToExport}` }) : null,
    blocked ? create('span', { className: 'sync-chip sync-chip-error', text: `Bloqueadas: ${blocked}` }) : null
  ]);

  if (items.length === 0 && readyToExport === 0) {
    setChildren(list, stateMessage('Nenhuma correcao aprovada para sincronizacao.', 'muted'));
    return;
  }

  if (items.length > 0) {
    setChildren(list, items.map(renderSyncItem));
  } else {
    setChildren(list, stateMessage(`Mirror sincronizado. ${readyToExport} item(ns) aguardando exportacao para o ERP.`, 'success'));
  }

  if (divergent > 0 || readyToExport > 0) {
    actions.hidden = false;
    const buttons = [];

    if (divergent > 0) {
      const pending = items.filter((item) => item.needsSync);
      buttons.push(create('button', {
        id: 'sync-preview',
        className: 'sync-preview-btn',
        type: 'button',
        text: 'Prever UPDATEs',
        onClick: () => runSync(pending, true, buttons[0])
      }));
      buttons.push(create('button', {
        id: 'sync-all',
        className: 'sync-all-btn',
        type: 'button',
        text: 'Sincronizar Aprovadas',
        onClick: () => runSync(pending, false, buttons[1])
      }));
    }

    if (readyToExport > 0) {
      buttons.push(create('button', {
        id: 'sync-export-sql',
        className: divergent > 0 ? 'sync-preview-btn' : 'sync-all-btn',
        type: 'button',
        text: 'Exportar Lote SQL',
        onClick: async () => {
          const result = await api.getBatchSql();
          if (result.error) {
            toast(`Erro ao gerar script: ${result.error}`, 'error');
          } else if (result.canceled) {
            toast('Exportacao cancelada.', 'info');
          } else {
            toast('Script SQL de lote exportado com sucesso.', 'success');
            loadSyncModule(); // Refresh to update readyToExport count
          }
        }
      }));
    }

    setChildren(actions, buttons);
  }
}

function renderSyncItem(item) {
  const statusClass = item.blocked ? 'sync-item-error' : item.needsSync ? 'sync-item-divergent' : 'sync-item-ok';
  return create('div', { className: `sync-item ${statusClass}` }, [
    create('div', { className: 'sync-item-header' }, [
      create('span', { className: 'sync-item-field', text: `${item.tabela_origem || 'bloqueado'}.${item.campo || '-'}` }),
      create('span', { className: 'sync-item-id', text: `ID: ${item.idpessoa}` })
    ]),
    create('div', { className: 'sync-item-values' }, [
      create('div', { className: 'sync-val-box' }, [
        create('span', { className: 'sync-val-label', text: 'Local:' }),
        create('span', { className: 'sync-val-text', text: item.valorLocal || '(vazio)' })
      ]),
      create('div', { className: 'sync-val-box' }, [
        create('span', { className: 'sync-val-label', text: 'ERP atual:' }),
        create('span', { className: 'sync-val-text', text: item.valorMirror || '(vazio)' })
      ])
    ]),
    item.error ? create('div', { className: 'sync-error', text: item.error }) : null,
    item.previewSql ? create('div', { className: 'sync-sql', text: item.previewSql }) : null
  ]);
}

async function runSync(items, dryRun, button) {
  button.disabled = true;
  button.textContent = dryRun ? 'Validando...' : 'Sincronizando...';

  const result = await api.performSync(items, { dryRun, usuario: 'gestor-sav' });
  if (result.error) {
    toast(`Erro na sincronizacao: ${result.error}`, 'error');
  } else if (dryRun) {
    const previews = (result.results || []).map((row) => row.sql).slice(0, 20);
    window.alert(previews.length ? previews.join('\n') : 'Nenhum UPDATE pendente.');
    toast('Previsao validada sem executar alteracoes.', 'success');
  } else {
    toast(`Sincronizacao concluida: ${result.syncedCount} itens processados.`, 'success');
  }

  button.disabled = false;
  button.textContent = dryRun ? 'Prever UPDATEs' : 'Sincronizar Aprovadas';
  loadSyncModule();
}
