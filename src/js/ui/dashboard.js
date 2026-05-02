import { $, setChildren, stateMessage } from '../utils.js';
import { api } from '../api.js';
import { MetricCard, MaintenanceBanner } from './components.js';

/**
 * CTO Dashboard UI (Phase 6)
 * Handles executive metrics and bulk export analytics.
 */

export async function loadDashboardModule() {
  const container = $('dashboard-metrics');

  setChildren(container, [stateMessage('Carregando metricas estrategicas...', 'info')]);

  try {
    const metrics = await api.getExecutiveMetrics();
    if (metrics.error) throw new Error(metrics.error);

    const dashboardItems = [
      MetricCard('Ações SAV Pendentes', metrics.sav.pending, {
        type: metrics.sav.pending > 10 ? 'warn' : 'success',
        subValue: `Total histórico: ${metrics.sav.total}`
      }),
      MetricCard('Interações WhatsApp (24h)', metrics.whatsapp.recent, {
        type: 'info'
      }),
      MetricCard('Clientes em Risco (ML)', metrics.intelligence.high_risk, {
        type: metrics.intelligence.high_risk > 50 ? 'error' : 'info',
        subValue: 'Score > 70'
      }),
      MetricCard('Oportunidade Sorocaba', metrics.intelligence.lookalikes, {
        type: 'success',
        subValue: 'Perfil Lookalike'
      }),
      MetricCard('Status do Sistema', metrics.system.status, {
        type: 'success',
        subValue: `Versão: ${metrics.system.version}`
      })
    ];

    setChildren(container, dashboardItems);

    if (metrics.system?.maintenance) {
      container.prepend(MaintenanceBanner());
    }

    setupExportButtons();
  } catch (e) {
    setChildren(container, [stateMessage(`Erro ao carregar metricas: ${e.message}`, 'error')]);
  }
}

function setupExportButtons() {
  // Add listeners for PDF exports
  document.querySelectorAll('.btn-export-pdf').forEach(btn => {
    btn.onclick = async () => {
      const bucket = btn.dataset.bucket;
      btn.disabled = true;
      btn.textContent = '...';
      const result = await api.bulkExportByPriority(bucket, 'pdf');
      btn.disabled = false;
      btn.textContent = 'PDF';
      if (result?.error) alert(`Erro: ${result.error}`);
      else if (result?.ok) alert(`Exportado com sucesso para: ${result.path}`);
    };
  });

  // Add listeners for Excel exports
  document.querySelectorAll('.btn-export-excel').forEach(btn => {
    btn.onclick = async () => {
      const bucket = btn.dataset.bucket;
      btn.disabled = true;
      btn.textContent = '...';
      const result = await api.bulkExportByPriority(bucket, 'excel');
      btn.disabled = false;
      btn.textContent = 'Excel';
      if (result?.error) alert(`Erro: ${result.error}`);
      else if (result?.ok) alert(`Exportado com sucesso para: ${result.path}`);
    };
  });
}

// Initial binding for refresh button
$('dashboard-refresh')?.addEventListener('click', loadDashboardModule);
