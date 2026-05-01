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
const { flushTelemetry, trackEvent } = require('./src/main/services/telemetryService');
const bulkIntelligenceService = require('./src/main/services/bulkIntelligenceService');

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
  mainWindow.setOpacity(0.95);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html')).finally(() => uiService.showExpanded());
  mainWindow.once('ready-to-show', () => uiService.showExpanded());
  mainWindow.webContents.once('did-finish-load', () => uiService.showExpanded());
  setTimeout(() => uiService.showExpanded(), 1000);
  setTimeout(() => uiService.showExpanded(), 2500);

  mainWindow.on('blur', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    if (!uiService.getState()) mainWindow.setOpacity(0.95);
  });

  mainWindow.on('focus', () => {
    if (!uiService.getState()) mainWindow.setOpacity(1.0);
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

  // 2. Local State
  initLocalDb(app.getPath('userData'));

  // 3. UI
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

  // 6. Check for OTA Updates and run initial sweep
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 10000); // Wait 10 seconds after boot to check for updates

  setTimeout(() => {
    bulkIntelligenceService.runSweep();
  }, 30000); // Initial sweep 30s after ready
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
