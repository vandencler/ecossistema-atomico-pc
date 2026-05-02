import { $, create, setChildren, stateMessage, toast } from '../utils.js';
import { api } from '../api.js';
import { MetricCard, StatusBadge } from './components.js';

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
    const identity = await api.getAppIdentity();
    setChildren(localContainer, [
      renderIdentitySection(identity),
      renderConfigForm(config)
    ]);
  }

  const opsContainer = $('ops-metrics-container');
  if (opsContainer && data && !data.error) {
    setChildren(opsContainer, renderOpsMetrics(data));
  }

  const supportContainer = $('support-links-container');
  if (supportContainer) {
    setChildren(supportContainer, renderSupportLinks());
  }
}

function renderSupportLinks() {
  const wikiUrl = 'https://wiki.atomico.com/guiarapido';
  
  const btnWiki = create('button', {
    className: 'btn-support-link',
    text: 'Abrir Wiki / FAQ',
    onclick: () => api.openExternal(wikiUrl)
  });

  const btnWA = create('button', {
    className: 'btn-support-wa',
    text: 'Suporte via WhatsApp',
    onclick: () => api.openWhatsApp({ phone: '5521999999999', text: 'Olá, preciso de ajuda com o sistema EAV.' })
  });

  const btnGuia = create('button', {
    className: 'btn-support-local',
    text: 'Ver Guia Rápido',
    onclick: async () => {
      const content = await api.getHelpContent('GUIA_RAPIDO.md');
      if (content.error) toast(content.error, 'error');
      else showHelpModal('Guia Rápido EAV', content);
    }
  });

  const btnFAQ = create('button', {
    className: 'btn-support-local',
    text: 'Ver FAQ Completo',
    onclick: async () => {
      const content = await api.getHelpContent('FAQ.md');
      if (content.error) toast(content.error, 'error');
      else showHelpModal('FAQ - Perguntas Frequentes', content);
    }
  });

  const btnMult = create('button', {
    className: 'btn-support-local',
    text: 'Guia do Multiplicador',
    onclick: async () => {
      const content = await api.getHelpContent('GUIA_MULTIPLICADOR.md');
      if (content.error) toast(content.error, 'error');
      else showHelpModal('Guia do Multiplicador (Fase 6)', content);
    }
  });

  return create('div', { className: 'support-links-grid' }, [
    create('div', { className: 'support-item' }, [
      create('div', { className: 'support-label', text: 'Onboarding (Local)' }),
      create('div', { className: 'support-desc', text: 'Documentação essencial disponível offline.' }),
      create('div', { className: 'support-actions' }, [btnGuia, btnFAQ, btnMult])
    ]),
    create('div', { className: 'support-item' }, [
      create('div', { className: 'support-label', text: 'Documentação Online' }),
      create('div', { className: 'support-desc', text: 'Wiki completa com vídeos e tutoriais atualizados.' }),
      btnWiki
    ]),
    create('div', { className: 'support-item' }, [
      create('div', { className: 'support-label', text: 'Atendimento Direto' }),
      create('div', { className: 'support-desc', text: 'Fale com um multiplicador via WhatsApp.' }),
      btnWA
    ])
  ]);
}

function showHelpModal(title, markdown) {
  const overlay = create('div', { className: 'dialog-overlay' });
  
  // Simple MD to HTML conversion
  const html = markdown
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\* (.*$)/gm, '<li>$1</li>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  const content = create('div', { className: 'help-modal-content' }, [
    create('div', { className: 'help-modal-header' }, [
      create('div', { className: 'help-modal-title', text: title }),
      create('button', { className: 'help-modal-close', text: '×', onclick: () => overlay.remove() })
    ]),
    create('div', { className: 'help-modal-body', innerHTML: html })
  ]);

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

function renderIdentitySection(identity) {
  const input = create('input', {
    className: 'config-input',
    value: identity,
    placeholder: 'Ex: rep-01, gestor-sul...'
  });

  const btn = create('button', {
    className: 'btn-save-config',
    text: 'Identificar',
    onclick: async () => {
      btn.disabled = true;
      const res = await api.setAppIdentity(input.value);
      if (res.ok) {
        // Also save to system config for persistence across restarts
        await api.setSystemConfig('app_identity', input.value);
        toast('Identidade atualizada: ' + res.identity, 'success');
      } else {
        toast('Erro: ' + res.error, 'error');
      }
      btn.disabled = false;
    }
  });

  return create('div', { className: 'form-group-box' }, [
    create('div', { className: 'form-title', text: 'Identidade do Sistema (Telemetria)' }),
    create('div', { className: 'config-input-group' }, [input, btn]),
    create('div', { className: 'config-desc', text: 'Esta identidade será vinculada a todos os eventos de telemetria e ações do SAV.' })
  ]);
}

function renderOpsMetrics(health) {
  const tel = health.telemetry || { totalEvents: 0, bufferedEvents: 0 };
  const mirror = health.databases.mirror || {};
  
  return create('div', { className: 'ops-metrics-grid' }, [
    MetricCard('Busca Otimizada', mirror.indexesOptimized ? 'SIM' : 'NÃO', { type: mirror.indexesOptimized ? 'success' : 'warn' }),
    MetricCard('Cache Offline', `${health.databases.ecosystem.cacheRows || 0} clientes`, { type: 'info' }),
    MetricCard('Telemetria Total', tel.totalEvents, { type: 'info' }),
    MetricCard('Buffer Offline', tel.bufferedEvents, { type: tel.bufferedEvents > 100 ? 'warn' : 'info' })
  ]);
}

function renderDbStatus(name, db) {
  const statusType = db.status === 'OK' ? 'success' : 'error';
  const detail = db.status === 'OK' ? db.version : db.error;
  
  return create('div', { className: 'db-status-item' }, [
    create('div', { className: 'db-name', text: name }),
    StatusBadge(db.status, { type: statusType }),
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
    createField('Intervalo Sync (Minutos)', settings.syncInterval || 5, (v) => settings.syncInterval = parseInt(v)),
    createField('ID Vendedor (Telemetria)', settings.userId || '', (v) => settings.userId = v, 'text', 'Ex: 101, 105...')
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
