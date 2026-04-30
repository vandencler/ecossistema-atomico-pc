import { $, create, setChildren, stateMessage } from '../utils.js';
import { api } from '../api.js';

export async function loadConfigModule() {
  const dbContainer = $('db-status-container');
  if (dbContainer) {
    setChildren(dbContainer, stateMessage('Verificando conexões...', 'muted'));
    const data = await api.getDbStatus();
    if (data.error) {
      setChildren(dbContainer, stateMessage(`Erro ao conectar: ${data.error}`, 'error'));
    } else {
      setChildren(dbContainer, [
        renderDbStatus('Mirror (Alterdata)', data.mirror),
        renderDbStatus('Ecosystem (Local)', data.ecosystem)
      ]);
    }
  }

  const sysContainer = $('system-configs-container');
  if (sysContainer) {
    setChildren(sysContainer, stateMessage('Carregando parâmetros...', 'muted'));
    const configs = await api.getSystemConfigs();
    if (configs.error) {
      setChildren(sysContainer, stateMessage(`Erro: ${configs.error}`, 'error'));
    } else {
      setChildren(sysContainer, renderSystemConfigs(configs.rows));
    }
  }
  
  const localContainer = $('local-settings-container');
  if (localContainer) {
    const config = await api.getConfig();
    setChildren(localContainer, renderConfigForm(config));
  }

  const opsContainer = $('ops-metrics-container');
  if (opsContainer && data && !data.error) {
    setChildren(opsContainer, renderOpsMetrics(data));
  }
}

function renderOpsMetrics(health) {
  const tel = health.telemetry || { totalEvents: 0, bufferedEvents: 0 };
  const mirror = health.databases.mirror || {};
  
  return create('div', { className: 'ops-metrics-grid' }, [
    createMetricCard('Busca Otimizada', mirror.indexesOptimized ? 'SIM' : 'NÃO', mirror.indexesOptimized ? 'success' : 'warn'),
    createMetricCard('Cache Offline', `${health.databases.ecosystem.cacheRows || 0} clientes`, 'info'),
    createMetricCard('Telemetria Total', tel.totalEvents, 'info'),
    createMetricCard('Buffer Offline', tel.bufferedEvents, tel.bufferedEvents > 100 ? 'warn' : 'info')
  ]);
}

function createMetricCard(label, value, type) {
  return create('div', { className: `metric-card metric-${type}` }, [
    create('div', { className: 'metric-label', text: label }),
    create('div', { className: 'metric-value', text: value })
  ]);
}

function renderDbStatus(name, db) {
  const statusClass = db.status === 'OK' ? 'status-ok' : 'status-error';
  const detail = db.status === 'OK' ? db.version : db.error;
  
  return create('div', { className: 'db-status-item' }, [
    create('div', { className: 'db-name', text: name }),
    create('div', { className: `db-status-indicator ${statusClass}`, text: db.status }),
    create('div', { className: 'db-version', text: detail || 'Indisponível' })
  ]);
}

function renderSystemConfigs(rows) {
  return rows.map((row) => {
    const input = create('input', {
      className: 'config-input',
      value: row.valor,
      type: 'text'
    });

    const btn = create('button', {
      className: 'btn-save-config',
      text: 'Salvar',
      onclick: async () => {
        btn.disabled = true;
        btn.textContent = '...';
        const res = await api.setSystemConfig(row.chave, input.value);
        if (res.ok) {
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = 'Salvar'; btn.disabled = false; }, 2000);
        } else {
          alert('Erro ao salvar: ' + res.error);
          btn.textContent = 'Erro';
          btn.disabled = false;
        }
      }
    });

    return create('div', { className: 'config-item' }, [
      create('div', { className: 'config-label-group' }, [
        create('div', { className: 'config-label', text: row.chave }),
        create('div', { className: 'config-desc', text: row.descricao || '' })
      ]),
      create('div', { className: 'config-input-group' }, [input, btn])
    ]);
  });
}

function renderConfigForm(config) {
  const container = create('div', { className: 'config-form' });

  // Database Sections
  const dbSections = ['mirror', 'ecosystem'].map(key => {
    const db = config.databases?.[key] || {};
    return create('div', { className: 'form-group-box' }, [
      create('div', { className: 'form-title', text: `Banco: ${key.toUpperCase()}` }),
      createField('Host', db.host, (v) => db.host = v),
      createField('Porta', db.port, (v) => db.port = parseInt(v)),
      createField('Banco', db.database, (v) => db.database = v),
      createField('Usuário', db.user, (v) => db.user = v),
      createField('Senha', '', (v) => db.password = v, 'password', 'Deixe vazio para manter')
    ]);
  });

  // App Settings
  const settings = config.settings || {};
  const settingsSection = create('div', { className: 'form-group-box' }, [
    create('div', { className: 'form-title', text: 'Configurações de App' }),
    createField('Ranking Cache (Horas)', settings.cacheTTL || 24, (v) => settings.cacheTTL = parseInt(v)),
    createCheckbox('Sync Automático', settings.autoSync, (v) => settings.autoSync = v),
    createField('Intervalo Sync (Minutos)', settings.syncInterval || 5, (v) => settings.syncInterval = parseInt(v))
  ]);

  const saveBtn = create('button', {
    className: 'btn-save-main-config',
    text: 'Salvar Tudo e Reiniciar Requerido',
    onclick: async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
      const res = await api.saveConfig(config);
      if (res.ok) {
        saveBtn.textContent = 'Configuração Salva! Reinicie o App.';
        saveBtn.classList.add('success');
        toast('Configurações salvas. Reinicie o aplicativo para aplicar.', 'success', 5000);
      } else {
        toast('Erro: ' + res.error, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Tentar Novamente';
      }
    }
  });

  setChildren(container, [...dbSections, settingsSection, saveBtn]);
  return container;
}

function createField(label, value, onchange, type = 'text', placeholder = '') {
  const input = create('input', {
    className: 'form-input',
    value: value || '',
    type: type,
    placeholder: placeholder,
    oninput: (e) => onchange(e.target.value)
  });

  return create('div', { className: 'form-field' }, [
    create('label', { className: 'form-label', text: label }),
    input
  ]);
}

function createCheckbox(label, checked, onchange) {
  const input = create('input', {
    type: 'checkbox',
    checked: !!checked,
    onchange: (e) => onchange(e.target.checked)
  });

  return create('div', { className: 'form-field checkbox' }, [
    create('label', { className: 'form-label', text: label }),
    input
  ]);
}
