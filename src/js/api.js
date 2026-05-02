import { toast } from './utils.js';

const baseApi = {
  toggleSidebar: () => window.atomico.toggleSidebar(),
  getSidebarState: () => window.atomico.getSidebarState(),
  moveTag: (deltaY) => window.atomico.moveTag(deltaY),
  saveTagPosition: () => window.atomico.saveTagPosition(),
  onSidebarToggled: (cb) => window.atomico.onSidebarToggled(cb),
  getNavigationAlerts: () => window.atomico.getNavigationAlerts(),
  searchClient: (query) => window.atomico.searchClient(query),
  birthdayCustomers: () => window.atomico.birthdayCustomers(),
  clientDashboard: (id) => window.atomico.clientDashboard(id),
  clientRecommendations: (id) => window.atomico.clientRecommendations(id),    
  savActionQueue: (filters) => window.atomico.savActionQueue(filters),        
  reviewSavAction: (data) => window.atomico.reviewSavAction(data),
  reviewSavActions: (data) => window.atomico.reviewSavActions(data),
  undoSavAction: (data) => window.atomico.undoSavAction(data),
  savActionHistory: (data) => window.atomico.savActionHistory(data),
  saveCorrection: (data) => window.atomico.saveCorrection(data),
  getTabelasPreco: () => window.atomico.getTabelasPreco(),
  getConvenios: () => window.atomico.getConvenios(),
  getSyncStatus: () => window.atomico.getSyncStatus(),
  performSync: (items, options) => window.atomico.performSync(items, options),
  getBatchSql: () => window.atomico.getBatchSql(),
  getDbStatus: () => window.atomico.getDbStatus(),
  getConfig: () => window.atomico.getConfig(),
  saveConfig: (config) => window.atomico.saveConfig(config),
  getSystemConfigs: () => window.atomico.getSystemConfigs(),
  setSystemConfig: (c, v) => window.atomico.setSystemConfig(c, v),
  getAppIdentity: () => window.atomico.getAppIdentity(),
  setAppIdentity: (id) => window.atomico.setAppIdentity(id),
  getHelpContent: (fileName) => window.atomico.getHelpContent(fileName),        
  getHealth: () => window.atomico.getHealth(),
  runReconciliation: () => window.atomico.runReconciliation(),
  openWhatsApp: (data) => window.atomico.openWhatsApp(data),
  openExternal: (url) => window.atomico.openExternal(url),
  exportClientData: (id, format) => window.atomico.exportClientData(id, format),
  bulkExportClients: (ids, format) => window.atomico.bulkExportClients(ids, format),
  bulkExportByPriority: (priorityBucket, format) => window.atomico.bulkExportByPriority(priorityBucket, format),
  onNotificationReceived: (cb) => window.atomico.onNotificationReceived(cb),    
  onNavigateTo: (cb) => window.atomico.onNavigateTo(cb),
  submitFeedback: (data) => window.atomico.submitFeedback(data),
  trackEvent: (name, payload, userId) => window.atomico.trackEvent({ name, payload, userId })
};

export const api = new Proxy(baseApi, {
  get(target, prop) {
    const value = target[prop];
    if (typeof value !== 'function') return value;

    return async (...args) => {
      try {
        return await value(...args);
      } catch (error) {
        if (error.message?.includes('THROTTLE_REJECTED')) {
          console.warn('[UI] API Throttled:', prop, error.message);
          toast('Sistema ocupado. Tentando novamente em instantes...', 'warn', 5000);
          
          await new Promise(r => setTimeout(r, 2000));
          return value(...args);
        }
        
        console.error('[UI] API Error:', prop, error);
        throw error;
      }
    };
  }
});
