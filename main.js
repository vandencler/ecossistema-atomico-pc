const { pool, ecoPool, settings } = require('./src/main/db');
const { initLocalDb } = require('./src/main/localDb');
const { logEvent, logError } = require('./src/main/services/logService');
const {
  getDbStatus,
  getConfig,
  saveConfig,
  getSystemConfigs,
  setSystemConfig,
  getConfigValue,
  validateConfig
} = require('./src/main/services/configService');
const { initializeDatabase } = require('./src/main/dbInit');
const uiService = require('./src/main/services/uiService');
const { startAutoSync, getSyncStatus, performSync, setupRealTimeListener, generateBatchScript, markBatchAsExported } = require('./src/main/services/syncService');
const { checkHealth } = require('./src/main/services/healthService');
const { warmUpCache } = require('./src/main/services/cacheService');
const { reconcileCorrections } = require('./src/main/services/reconciliationService');
const { flushTelemetry, trackEvent, setIdentity, getIdentity } = require('./src/main/services/telemetryService');
const bulkIntelligenceService = require('./src/main/services/bulkIntelligenceService');
const npsService = require('./src/main/services/npsService');

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const { searchClient, getBirthdayCustomers, getClientDashboard, getRecommendations } = require('./src/main/services/clientService');
const { saveCorrection } = require('./src/main/services/correctionService');
const { getActionQueue, getActionHistory, reviewAction, reviewActions, undoActionReview } = require('./src/main/services/savService');
const { getPriceTables, getConvenios } = require('./src/main/services/lookupService');
const { exportClientData, bulkExportClients } = require('./src/main/services/exportService');
const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

// --- Global Initialization ---

// Auto-Updater Configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', () => {
  logEvent('SYSTEM_UPDATE', '0', 'Atualizacao detectada. Iniciando download.');
});

autoUpdater.on('update-downloaded', () => {
  logEvent('SYSTEM_UPDATE', '0', 'Download concluido. Instalacao na proxima inicializacao.');
  // Optionally, we could prompt the user here using dialog.showMessageBox to restart immediately.
});

autoUpdater.on('error', (err) => {
  console.error('[UPDATER] Erro na verificacao de atualizacao:', err.message);
});

async function runPreFlight() {
  try {
    const status = await getDbStatus();

    if (status.ecosystem.status === 'OK') {
      console.log('[INIT] Conectado ao banco de dados Ecosystem.');
      const init = await initializeDatabase();
      if (init.ok) {
        await logEvent('SYSTEM_START', '0', 'Aplicação inicializada com sucesso.');
      } else {
        console.error('[CRITICAL] Falha ao inicializar esquema do banco:', init.error);
      }
    } else {
      console.error('[CRITICAL] Falha na conexão inicial do Ecosystem:', status.ecosystem.error);
    }

    if (status.mirror.status === 'OK') {
      console.log('[INIT] Conectado ao banco de dados Mirror.');
    } else {
      console.warn('[WARN] Falha na conexão inicial do Mirror (ERP):', status.mirror.error);
    }
  } catch (e) {
    console.error('[CRITICAL] Erro inesperado durante pre-flight check:', e.message);
    await logError('PREFLIGHT', e);
  }
}

function createWindow() {
  const { x, y, w, h } = uiService.getScreenEdge();

  const mainWindow = new BrowserWindow({
    title: 'Sistema Atomico de Vendas',
    width: uiService.SIDEBAR_WIDTH,
    height: h,
    x: x + w - uiService.SIDEBAR_WIDTH,
    y: y,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0e1a',
    resizable: false,
    movable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  uiService.setWindow(mainWindow);
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setOpacity(1.0);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (uiService.getState()) {
      uiService.showExpanded();
    } else {
      uiService.showCollapsed();
    }
  });

  mainWindow.on('blur', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    console.log('[MAIN] Window blurred, forcing AlwaysOnTop');
  });

  mainWindow.on('focus', () => {
    if (!uiService.getState()) mainWindow.setOpacity(1.0);
    console.log('[MAIN] Window focused');
  });

  screen.on('display-metrics-changed', () => uiService.handleDisplayMetricsChanged());
}

// --- IPC Handlers with Validation ---

const safeInvoke = (handler, validator = (x) => x) => async (event, ...args) => {
  const start = Date.now();
  const channel = event.sender.getURL().split('/').pop() + '::' + handler.name;
  try {
    const validatedArgs = args.map((arg, i) => validator(arg, i));
    const result = await handler(event, ...validatedArgs);
    
    // Performance Telemetry
    const duration = Date.now() - start;
    if (duration > 100) { // Only track slower calls to avoid noise
      trackEvent('ipc_perf_low', 'sistema', { channel, duration_ms: duration }).catch(() => {});
    }

    return result;
  } catch (e) {
    console.error(`[IPC ERROR] ${channel} failed:`, e.message);
    return { error: `Invalid request: ${e.message}` };
  }
};

const idValidator = (id) => {
  if (typeof id !== 'string' || id.length > 40) throw new Error('Invalid ID format');
  return id.trim();
};

const searchValidator = (q) => {
  if (typeof q !== 'string' || q.length > 200) throw new Error('Query too long');
  return q;
};

// UI Orchestration
ipcMain.handle('toggle-sidebar', () => uiService.toggleSidebar());
ipcMain.handle('get-sidebar-state', () => uiService.getState());
ipcMain.handle('move-tag', (event, deltaY) => uiService.moveTag(deltaY));
ipcMain.handle('save-tag-position', () => uiService.saveTagPosition());
ipcMain.handle('get-navigation-alerts', () => uiService.getNavigationAlerts());

// Client Domain
ipcMain.handle('search-client', safeInvoke((e, q) => searchClient(q), searchValidator));
ipcMain.handle('birthday-customers', safeInvoke(() => getBirthdayCustomers()));
ipcMain.handle('client-dashboard', safeInvoke((e, id) => getClientDashboard(id), idValidator));
ipcMain.handle('client-recommendations', safeInvoke((e, id) => getRecommendations(id), idValidator));

// Correction Domain
ipcMain.handle('sav-action-queue', safeInvoke((e, filters) => getActionQueue(filters || {})));
ipcMain.handle('review-sav-action', safeInvoke((e, p) => reviewAction(p)));
ipcMain.handle('review-sav-actions', safeInvoke((e, p) => reviewActions(p)));
ipcMain.handle('undo-sav-action', safeInvoke((e, p) => undoActionReview(p)));
ipcMain.handle('sav-action-history', safeInvoke((e, p) => getActionHistory(p)));
ipcMain.handle('save-correction', safeInvoke((e, p) => saveCorrection(p)));
ipcMain.handle('get-tabelas-preco', safeInvoke(() => getPriceTables()));
ipcMain.handle('get-convenios', safeInvoke(() => getConvenios()));

// Sync Domain
ipcMain.handle('get-sync-status', safeInvoke(() => getSyncStatus()));
ipcMain.handle('perform-sync', safeInvoke((e, items, options) => performSync(items, options || {})));
ipcMain.handle('get-batch-sql', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(uiService.mainWindow, {
      title: 'Exportar Lote de Correção SQL',
      defaultPath: `SAV_Batch_${new Date().toISOString().split('T')[0]}.sql`,
      filters: [{ name: 'SQL Script', extensions: ['sql'] }]
    });

    if (canceled || !filePath) return { canceled: true };

    const result = await generateBatchScript();
    if (result.error) return result;

    const fs = require('fs').promises;
    await fs.writeFile(filePath, result.sql, 'utf8');
    
    // Mark items as exported in the database
    if (result.ids && result.ids.length > 0) {
      const loteId = await markBatchAsExported(result.ids);
      await logEvent('SAV_BATCH_EXPORT', '0', `Script de lote ${loteId} exportado para: ${filePath} (${result.ids.length} itens)`);
    } else {
      await logEvent('SAV_BATCH_EXPORT', '0', `Script de lote vazio exportado para: ${filePath}`);
    }

    return { ok: true, filePath };
  } catch (e) {
    console.error('[IPC ERROR] Batch SQL export failed:', e.message);
    return { error: e.message };
  }
});

// System Domain
ipcMain.handle('get-db-status', safeInvoke(() => getDbStatus()));
ipcMain.handle('get-config', safeInvoke(() => getConfig()));
ipcMain.handle('save-config', safeInvoke((e, config) => saveConfig(config), validateConfig));
ipcMain.handle('get-system-configs', safeInvoke(() => getSystemConfigs()));
ipcMain.handle('set-system-config', safeInvoke((e, c, v) => setSystemConfig(c, v)));
ipcMain.handle('get-health', safeInvoke(() => checkHealth()));
ipcMain.handle('run-reconciliation', safeInvoke(() => reconcileCorrections()));
ipcMain.handle('open-whatsapp', safeInvoke((e, p) => uiService.openWhatsApp(p)));
ipcMain.handle('open-external', safeInvoke((e, url) => {
  const { shell } = require('electron');
  return shell.openExternal(url);
}));

// Identity Domain
ipcMain.handle('get-app-identity', () => getIdentity());
ipcMain.handle('set-app-identity', safeInvoke(async (e, id) => {
  const oldId = getIdentity();
  setIdentity(id);
  
  // Phase 6: Send welcome message via WhatsApp if it's a new identity
  if (id && id !== oldId) {
    const omnichannelService = require('./src/main/services/omnichannelService');
    omnichannelService.sendWelcomeMessage(id).catch(err => {
      console.warn('[MAIN] Failed to send welcome message:', err.message);
    });
  }

  return { ok: true, identity: getIdentity() };
}, idValidator));

ipcMain.handle('submit-feedback', safeInvoke((e, data) => recordFeedback(data.satisfaction, data.comment, data.deviceInfo)));
ipcMain.handle('track-event', safeInvoke((e, data) => trackEvent(data.name, data.userId || 'auto', data.payload)));

// Help Domain
ipcMain.handle('get-help-content', safeInvoke(async (event, fileName) => {
  const fs = require('fs').promises;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, ''); // Basic sanitization
  const filePath = path.join(__dirname, 'docs', 'onboarding', safeName);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    console.error(`[IPC ERROR] Help file ${fileName} not found:`, e.message);
    return { error: 'Arquivo de ajuda não encontrado.' };
  }
}));

ipcMain.handle('get-executive-metrics', async () => {
  try {
    const { ecoPool } = require('./src/main/db');
    
    const savRes = await ecoPool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'PENDENTE') as pending FROM acoes_pendentes");
    const waRes = await ecoPool.query("SELECT COUNT(*) as total FROM omnichannel_mensagens WHERE criado_em > CURRENT_TIMESTAMP - INTERVAL '24 hours'");
    const clientRes = await ecoPool.query('SELECT COUNT(*) as total FROM ml_churn_risk WHERE risk_score > 70');
    
    // Lookalike Opportunities (Sorocaba region with high priority)
    const lookalikeRes = await ecoPool.query(`
      SELECT COUNT(*) as total 
      FROM ml_client_profiles 
      WHERE cidade = 'Sorocaba' AND stcredbloqueado = false
    `);

    const npsSummary = await npsService.getSummary();
    
    return {
      sav: {
        total: parseInt(savRes.rows[0].total),
        pending: parseInt(savRes.rows[0].pending)
      },
      whatsapp: {
        recent: parseInt(waRes.rows[0].total)
      },
      intelligence: {
        high_risk: parseInt(clientRes.rows[0].total),
        lookalikes: parseInt(lookalikeRes.rows[0].total)
      },
      nps: npsSummary,
      system: {
        version: 'v1.1.2',
        status: 'OPTIMIZED'
      }
    };
  } catch (e) {
    console.error('[IPC ERROR] Executive metrics failed:', e.message);
    return { error: e.message };
  }
});

ipcMain.handle('export-client-data', async (event, idpessoa, format) => {
  try {
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const filters = format === 'pdf' 
      ? [{ name: 'PDF', extensions: ['pdf'] }] 
      : [{ name: 'Excel', extensions: ['xlsx'] }];
      
    const { canceled, filePath } = await dialog.showSaveDialog(uiService.mainWindow, {
      title: 'Exportar Relatorio do Cliente',
      defaultPath: `Cliente_${idpessoa}_${new Date().toISOString().split('T')[0]}.${ext}`,
      filters
    });

    if (canceled || !filePath) return { canceled: true };

    return await exportClientData(idpessoa, format, filePath);
  } catch (e) {
    console.error('[IPC ERROR] Export failed:', e.message);
    return { error: e.message };
  }
});

ipcMain.handle('bulk-export-clients', async (event, ids, format) => {
  try {
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const filters = format === 'pdf' 
      ? [{ name: 'PDF', extensions: ['pdf'] }] 
      : [{ name: 'Excel', extensions: ['xlsx'] }];
      
    const { canceled, filePath } = await dialog.showSaveDialog(uiService.mainWindow, {
      title: 'Exportar Relatorio em Lote',
      defaultPath: `Lote_Clientes_${new Date().toISOString().split('T')[0]}.${ext}`,
      filters
    });

    if (canceled || !filePath) return { canceled: true };

    return await bulkExportClients(ids, format, filePath);
  } catch (e) {
    console.error('[IPC ERROR] Bulk Export failed:', e.message);
    return { error: e.message };
  }
});

ipcMain.handle('bulk-export-priority', async (event, priorityBucket, format) => {
  try {
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const filters = format === 'pdf' 
      ? [{ name: 'PDF', extensions: ['pdf'] }] 
      : [{ name: 'Excel', extensions: ['xlsx'] }];
      
    const { canceled, filePath } = await dialog.showSaveDialog(uiService.mainWindow, {
      title: `Exportar Prioridade ${priorityBucket.toUpperCase()}`,
      defaultPath: `Prioridade_${priorityBucket}_${new Date().toISOString().split('T')[0]}.${ext}`,
      filters
    });

    if (canceled || !filePath) return { canceled: true };

    return await bulkExportByPriority(priorityBucket, format, filePath);
  } catch (e) {
    console.error('[IPC ERROR] Bulk Export Priority failed:', e.message);
    return { error: e.message };
  }
});

// --- Startup & Lifecycle ---

app.whenReady().then(async () => {
  // 1. Initial Checks
  await runPreFlight();

  // 1b. Initialize Identity
  const savedIdentity = await getConfigValue('app_identity');
  if (savedIdentity) setIdentity(savedIdentity);

  // 2. Local State
  initLocalDb(app.getPath('userData'));

  // 3. UI
  await uiService.initializeState();
  createWindow();

  // 4. Background Services
  await checkHealth();

  // Start Auto-Sync based on hierarchy: File Settings > DB Settings > Default (10m)
  if (settings.autoSync) {
    startAutoSync(settings.syncInterval * 60000);
  } else {
    const dbAutoSync = await getConfigValue('auto_sync_enabled', 'true');
    if (dbAutoSync === 'true') {
      const dbInterval = await getConfigValue('auto_sync_interval_minutes', '10');
      startAutoSync(parseInt(dbInterval, 10) * 60000);
    }
  }

  // 4b. Setup Real-Time Sync Listener
  setupRealTimeListener();

  // 5. Periodic Maintenance
  warmUpCache();
  setInterval(() => warmUpCache(), 7200000); // 2h
  setInterval(() => checkHealth(), 1800000); // 30m
  setInterval(() => reconcileCorrections(), 43200000); // 12h
  setInterval(() => flushTelemetry(), 900000); // 15m
  setInterval(() => bulkIntelligenceService.runSweep(), 21600000); // 6h
  setInterval(() => npsService.runCycle(), 43200000); // 12h
  setInterval(() => uiService.revalidateBounds(), 5000); // 1m check

  // 6. Check for OTA Updates and run initial sweep
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 10000); // Wait 10 seconds after boot to check for updates

  setTimeout(() => {
    bulkIntelligenceService.runSweep();
  }, 30000); // Initial sweep 30s after ready

  setTimeout(() => {
    npsService.runCycle();
  }, 60000); // Initial NPS check 1m after ready
});

app.on('before-quit', async () => {
  try {
    await logEvent('SYSTEM_SHUTDOWN', '0', 'Aplicação encerrada.');
    await Promise.allSettled([pool.end(), ecoPool.end()]);
  } catch (e) {
    console.error('Erro ao encerrar conexões:', e.message);
    await logError('SHUTDOWN', e);
  }
});

app.on('window-all-closed', () => app.quit());
