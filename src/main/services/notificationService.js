const { Notification } = require('electron');
const uiService = require('./uiService');

/**
 * Notification Service: Handles desktop alerts and IPC events for critical SAV actions.
 */
class NotificationService {
  /**
   * Shows a native desktop notification and sends an IPC event to the renderer.
   * @param {Object} options - Notification options.
   * @param {string} options.title - Notification title.
   * @param {string} options.body - Notification message.
   * @param {string} [options.type] - Type of notification (info, warning, error).
   * @param {Function} [options.onClick] - Optional click handler.
   */
  notify(options) {
    if (!Notification.isSupported()) {
      console.warn('[NOTIFY] Desktop notifications are not supported on this platform.');
      return;
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      silent: options.silent || false,
    });

    if (options.onClick) {
      notification.on('click', options.onClick);
    }

    notification.show();
    
    // Also notify renderer via IPC if window is available
    const win = uiService.mainWindow;
    if (win) {
      win.webContents.send('notification-received', {
        title: options.title,
        body: options.body,
        type: options.type || 'info'
      });
    }
  }

  /**
   * Specifically for critical SAV actions (priority >= 80).
   */
  notifyCriticalAction(action) {
    this.notify({
      title: 'Ação Crítica SAV',
      body: `Pendente: ${action.nome_pessoa || 'Cliente'} - ${action.campo}`,
      type: 'warning',
      onClick: () => {
        const win = uiService.mainWindow;
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
          win.webContents.send('navigate-to', 'sav');
        }
      }
    });
  }

  /**
   * Specifically for execution errors.
   */
  notifyExecutionError(action, error) {
    this.notify({
      title: 'Erro na Execução SAV',
      body: `Falha ao processar: ${action.nome_pessoa || 'Ação'}. ${error}`,
      type: 'error'
    });
  }
}

module.exports = new NotificationService();
