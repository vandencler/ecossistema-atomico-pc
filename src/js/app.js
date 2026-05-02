
window.addEventListener('error', (event) => {
  console.error('[UI FATAL]', event.error);
  if (window.atomico && window.atomico.submitFeedback) {
    window.atomico.submitFeedback({
      satisfaction: 0,
      comment: 'Erro automatico detectado na UI: ' + event.message,
      deviceInfo: navigator.userAgent
    }).catch(() => {});
  }
});
import { $, toast } from './utils.js';
import { api } from './api.js';
import { setupNavigation, updateNavAlerts, navigateTo } from './modules/navigation.js';
import { setupSearch } from './modules/search.js';
import { openClient, openWhatsApp } from './modules/dashboard.js';
import { setupCorrections } from './modules/corrections.js';
import { setupFeedback } from './ui/feedback.js';

let isDragging = false;
let dragStartY = 0;
let dragMoved = false;

function setSidebarState(expanded) {
  const tab = $('collapsed-tab');
  const sidebar = $('sidebar');
  
  if (!tab || !sidebar) {
    console.error('[UI] Elementos da sidebar nao encontrados no DOM!');
    return;
  }

  const isExpanded = !!expanded;
  tab.hidden = isExpanded;
  sidebar.hidden = !isExpanded;
  
  console.log('[UI] Sidebar state set:', isExpanded ? 'EXPANDED' : 'COLLAPSED');
  
  if (isExpanded) {
    const input = $('search-input');
    if (input) setTimeout(() => input.focus(), 50);
  }
}

function setupSidebar() {
  api.onSidebarToggled(setSidebarState);

  const tab = $('collapsed-tab');
  tab.addEventListener('mousedown', (event) => {
    isDragging = true;
    dragStartY = event.screenY;
    dragMoved = false;
    event.preventDefault();
  });

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    const deltaY = event.screenY - dragStartY;
    if (Math.abs(deltaY) > 3) {
      dragMoved = true;
      dragStartY = event.screenY;
      api.moveTag(deltaY);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging && !dragMoved) api.toggleSidebar();
    isDragging = false;
    dragMoved = false;
  });

  $('btn-collapse')?.addEventListener('click', () => api.toggleSidebar());
}

function setupNotifications() {
  api.onNotificationReceived((data) => {
    toast(data.body, data.type || 'info', 5000);
    updateNavAlerts();
  });

  api.onNavigateTo((section) => {
    navigateTo(section);
  });
}

(async function init() {
  setupSidebar();
  setupNotifications();
  setupNavigation({ 
    onOpenClient: openClient, 
    onOpenWhatsApp: openWhatsApp 
  });
  setupSearch(openClient);
  setupCorrections();
  setupFeedback();
  
  const expanded = await api.getSidebarState();
  setSidebarState(expanded);

  updateNavAlerts();
  setInterval(updateNavAlerts, 60000);
})();
