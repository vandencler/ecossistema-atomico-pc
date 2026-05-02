const { screen, shell } = require('electron');
const { readNumber } = require('../utils');

class UIService {
  constructor() {
    this.isExpanded = false;
    this.SIDEBAR_WIDTH = 420;
    this.COLLAPSED_WIDTH = 36;
    this.COLLAPSED_HEIGHT = 36;
    this.mainWindow = null;
    this.tagY = -1;
    this.initialized = false;
  }

  setWindow(window) {
    this.mainWindow = window;
  }

  async initializeState() {
    if (this.initialized) return;
    const { getConfigValue } = require('./configService');
    const expanded = await getConfigValue('ui_sidebar_expanded', 'true');
    const savedTagY = await getConfigValue('ui_sidebar_tag_y', '-1');
    
    this.isExpanded = expanded === 'true';
    this.tagY = parseInt(savedTagY, 10);
    this.initialized = true;
    console.log(`[UI] State initialized: expanded=${this.isExpanded}, tagY=${this.tagY}`);
  }

  getScreenEdge() {
    const display = screen.getPrimaryDisplay();
    const wa = display.workArea;
    return { x: wa.x, y: wa.y, w: wa.width, h: wa.height };
  }

  async toggleSidebar() {
    const { logEvent } = require('./logService');
    const { setSystemConfig } = require('./configService');
    if (!this.mainWindow) return false;
    
    this.isExpanded = !this.isExpanded;
    await setSystemConfig('ui_sidebar_expanded', String(this.isExpanded));

    if (this.isExpanded) {
      this.showExpanded();
      logEvent('UI_SIDEBAR_EXPAND', '0', 'Sidebar expandida pelo usuario');
    } else {
      this.showCollapsed();
      logEvent('UI_SIDEBAR_COLLAPSE', '0', 'Sidebar recolhida pelo usuario');
    }

    return this.isExpanded;
  }

  showExpanded() {
    if (!this.mainWindow) return false;
    const { x, y, w, h } = this.getScreenEdge();
    this.isExpanded = true;
    this.mainWindow.setOpacity(1.0);
    this.mainWindow.setBounds({ x: x + w - this.SIDEBAR_WIDTH, y, width: this.SIDEBAR_WIDTH, height: h });
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    this.mainWindow.show();
    this.mainWindow.restore(); // Ensure it is not minimized
    this.mainWindow.focus();
    this.mainWindow.moveTop();
    this.mainWindow.webContents.send('sidebar-toggled', true);
    return true;
  }

  showCollapsed() {
    if (!this.mainWindow) return false;
    const { x, y, w, h } = this.getScreenEdge();
    if (this.tagY === -1) this.tagY = y + Math.round(h * 0.25);
    const tagY = this.tagY;
    this.isExpanded = false;
    this.mainWindow.setOpacity(1.0);
    this.mainWindow.setBounds({ x: x + w - this.COLLAPSED_WIDTH, y: tagY, width: this.COLLAPSED_WIDTH, height: this.COLLAPSED_HEIGHT });
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    this.mainWindow.show();
    this.mainWindow.restore(); // Ensure it is not minimized
    this.mainWindow.moveTop();
    this.mainWindow.webContents.send('sidebar-toggled', false);
    console.log(`[UI] Sidebar collapsed at y=${tagY}`);
    return true;
  }

  revalidateBounds() {
    if (!this.mainWindow) return;
    const bounds = this.mainWindow.getBounds();
    const s = this.getScreenEdge();
    
    // If window is completely off-screen, or hidden, or not on top, reset it
    const isOffScreen = bounds.x < s.x - 100 || bounds.x > s.x + s.w + 100;
    const isMinimized = this.mainWindow.isMinimized();
    const isVisible = this.mainWindow.isVisible();
    
    if (isOffScreen || isMinimized || !isVisible || !this.mainWindow.isAlwaysOnTop()) {
      console.warn(`[UI] Window anomaly detected (OffScreen=${isOffScreen}, Minimized=${isMinimized}, Visible=${isVisible}), resetting...`);
      this.isExpanded ? this.showExpanded() : this.showCollapsed();
    } else {
      // Force always on top again just in case
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  getState() {
    return this.isExpanded;
  }

  moveTag(deltaY) {
    if (this.isExpanded || !this.mainWindow) return;
    const { y: waY, h: waH } = this.getScreenEdge();
    const bounds = this.mainWindow.getBounds();
    const safeDelta = readNumber(deltaY, 0);
    let newY = bounds.y + safeDelta;
    newY = Math.max(waY, Math.min(newY, waY + waH - this.COLLAPSED_HEIGHT));
    this.tagY = newY;
    this.mainWindow.setBounds({ x: bounds.x, y: newY, width: bounds.width, height: bounds.height });
  }

  async saveTagPosition() {
    const { setSystemConfig } = require('./configService');
    if (this.tagY !== -1) {
      await setSystemConfig('ui_sidebar_tag_y', String(this.tagY));
    }
  }

  async openWhatsApp(payload) {
    try {
      const digits = String(payload?.phone || '').replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) return { error: 'Telefone invalido para WhatsApp' };
      const phone = digits.startsWith('55') ? digits : `55${digits}`;
      const message = String(payload?.message || '').slice(0, 1200);
      const url = `https://web.whatsapp.com/send?phone=${phone}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
      await shell.openExternal(url);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  handleDisplayMetricsChanged() {
    if (!this.mainWindow) return;
    const s = this.getScreenEdge();
    if (this.isExpanded) {
      this.mainWindow.setBounds({ x: s.x + s.w - this.SIDEBAR_WIDTH, y: s.y, width: this.SIDEBAR_WIDTH, height: s.h });
    } else {
      if (this.tagY === -1) this.tagY = s.y + Math.round(s.h * 0.25);
      // Ensure tagY is still on screen
      this.tagY = Math.max(s.y, Math.min(this.tagY, s.y + s.h - this.COLLAPSED_HEIGHT));
      const tY = this.tagY;
      this.mainWindow.setBounds({ x: s.x + s.w - this.COLLAPSED_WIDTH, y: tY, width: this.COLLAPSED_WIDTH, height: this.COLLAPSED_HEIGHT });
    }
  }

  async getNavigationAlerts() {
    const { ecoPool } = require('../db');
    const { getConfigValue } = require('./configService');
    try {
      const urgencyHours = await getConfigValue('sav_urgency_hours', '4');
      const counts = await ecoPool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO' AND COALESCE(status, 'PENDENTE') = 'PENDENTE') as sav_count,
          COUNT(*) FILTER (WHERE status = 'PENDENTE' AND (origem = 'MANUAL' AND criado_em < NOW() - ($1 || ' hours')::interval)) as sav_urgent
        FROM acoes_pendentes
      `, [urgencyHours]);
      
      return {
        sav: {
          count: parseInt(counts.rows[0].sav_count || 0),
          urgent: parseInt(counts.rows[0].sav_urgent || 0)
        }
      };
    } catch (e) {
      console.error('Falha ao obter alertas de navegaÃ§Ã£o:', e.message);
      return { sav: { count: 0, urgent: 0 } };
    }
  }
}

module.exports = new UIService();
