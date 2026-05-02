import { $, create, setChildren, stateMessage } from '../utils.js';
import { api } from '../api.js';
import { MetricCard, StatusBadge, ActionGroup, IconButton } from './components.js';

export async function loadHealthModule() {
  const container = $('health-dashboard-container');
  if (!container) return;

  setChildren(container, stateMessage('Realizando diagnóstico completo...', 'muted'));

  try {
    const health = await api.getHealth();
    renderHealthDashboard(container, health);
  } catch (e) {
    setChildren(container, stateMessage('Erro ao carregar saúde: ' + e.message, 'error'));
  }
}

function renderHealthDashboard(container, health) {
  const sections = [
    renderSystemStatus(health),
    renderDatabaseSection('Mirror (ERP Alterdata)', health.databases.mirror, [
      { label: 'Status', value: health.databases.mirror.status, type: health.databases.mirror.status === 'OK' ? 'success' : 'error' },
      { label: 'Latência', value: `${health.databases.mirror.latencyMs}ms`, type: 'info' },
      { label: 'Otimização de Busca', value: health.databases.mirror.indexesOptimized ? 'COMPLETA' : 'DEGRADADA', type: health.databases.mirror.indexesOptimized ? 'success' : 'warn' }
    ], renderIndexList(health.databases.mirror)),
    
    renderDatabaseSection('Ecosystem (Inteligência)', health.databases.ecosystem, [
      { label: 'Status', value: health.databases.ecosystem.status, type: health.databases.ecosystem.status === 'OK' ? 'success' : 'error' },
      { label: 'Latência', value: `${health.databases.ecosystem.latencyMs}ms`, type: 'info' },
      { label: 'Clientes em Cache', value: health.databases.ecosystem.cacheRows, type: 'info' }
    ]),

    renderTelemetrySection(health.telemetry, health.syncMetrics),
    
    renderAnalyticalReports()
  ];

  setChildren(container, sections);
}

function renderSystemStatus(health) {
  const isHealthy = health.status === 'HEALTHY';
  return create('div', { className: 'health-hero' }, [
    StatusBadge(isHealthy ? 'SISTEMA OPERACIONAL' : 'SISTEMA DEGRADADO', { 
      type: isHealthy ? 'success' : 'error' 
    }),
    create('div', { className: 'health-timestamp', text: `Última verificação: ${new Date(health.timestamp).toLocaleString()}` })
  ]);
}

function renderAnalyticalReports() {
  const exportPriority = async (bucket, format) => {
    try {
      const res = await api.bulkExportByPriority(bucket, format);
      if (res?.ok) {
        console.log(`Relatório de prioridade ${bucket} (${format}) exportado.`);
      } else if (res?.error) {
        alert(`Erro ao exportar: ${res.error}`);
      }
    } catch (e) {
      alert(`Erro: ${e.message}`);
    }
  };

  return create('div', { className: 'health-section' }, [
    create('div', { className: 'health-section-title', text: 'Relatórios Analíticos de Gestão' }),
    create('div', { className: 'analytical-grid' }, [
      { label: 'Clientes Prioridade A (Diamante)', bucket: 'A', color: 'sav-open-btn' },
      { label: 'Clientes Prioridade B (Ouro)', bucket: 'B', color: 'sav-history-btn' },
      { label: 'Clientes Prioridade C (Prata)', bucket: 'C', color: '' }
    ].map(item => create('div', { className: 'analytical-row' }, [
        create('span', { text: item.label }),
        ActionGroup([
          IconButton('PDF', () => exportPriority(item.bucket, 'pdf'), { className: item.color, icon: 'FILE_TEXT' }),
          IconButton('Excel', () => exportPriority(item.bucket, 'excel'), { className: item.color, icon: 'FILE_SPREADSHEET' })
        ])
      ]))
    )
  ]);
}

function renderDatabaseSection(title, db, metrics, extra) {
  return create('div', { className: 'health-section' }, [
    create('div', { className: 'health-section-title', text: title }),
    create('div', { className: 'health-metrics-grid' }, 
      metrics.map(m => MetricCard(m.label, m.value, { type: m.type }))
    ),
    extra || null
  ]);
}
function renderIndexList(mirror) {
  if (!mirror.foundIndexes) return null;

  const allExpected = [
    'idx_pessoas_nmpessoa_trgm', 
    'idx_pessoas_nmcurto_trgm', 
    'idx_pessoas_cdchamada_trgm',
    'idx_pessoas_nrcgc_cic_trgm',
    'idx_pessoas_telwa_trgm',
    'idx_pessoas_phone_trgm'
  ];

  return create('div', { className: 'index-status-box' }, [
    create('div', { className: 'index-status-title', text: 'Status dos Índices de Busca (Trigram)' }),
    create('ul', { className: 'index-list' }, allExpected.map(idx => {
      let found = mirror.foundIndexes.includes(idx);
      let label = idx;

      // Special logic for phone indexes
      if (idx === 'idx_pessoas_telwa_trgm' || idx === 'idx_pessoas_phone_trgm') {
        if (!found && mirror.foundIndexes.includes('idx_pessoas_phones_trgm')) {
          found = true;
          label += ' (via legacy)';
        }
      }

      return create('li', { className: `index-item ${found ? 'ok' : 'missing'}` }, [
        create('span', { className: 'index-icon', text: found ? '✅' : '❌' }),
        create('span', { className: 'index-name', text: label })
      ]);
    }))
  ]);
}

function renderTelemetrySection(tel, sync) {
  if (!tel) return null;
  
  const cards = [
    MetricCard('Eventos Totais', tel.totalEvents, { type: 'info' }),
    MetricCard('Buffer Local', tel.bufferedEvents, { type: tel.bufferedEvents > 100 ? 'warn' : 'info' }),
    MetricCard('Eventos (24h)', tel.recentEvents24h || 0, { type: 'info' })
  ];

  if (sync) {
    const latencyText = sync.avgLatencySeconds > 3600 
      ? `${Math.round(sync.avgLatencySeconds / 3600)}h`
      : sync.avgLatencySeconds > 60 
        ? `${Math.round(sync.avgLatencySeconds / 60)}m` 
        : `${sync.avgLatencySeconds}s`;

    cards.push(MetricCard('Latência Sync', latencyText, { type: sync.avgLatencySeconds > 86400 ? 'warn' : 'success' }));
    cards.push(MetricCard('Itens Sincronizados', sync.processedCount, { type: 'info' }));
  }

  return create('div', { className: 'health-section' }, [
    create('div', { className: 'health-section-title', text: 'Telemetria e Performance de Sync' }),
    create('div', { className: 'health-metrics-grid' }, cards)
  ]);
}
