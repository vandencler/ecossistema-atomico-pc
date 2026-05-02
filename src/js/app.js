
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

function setSidebarState(expanded, source = 'unknown') {
  const tab = $('collapsed-tab');
  const sidebar = $('sidebar');
  
  if (!tab || !sidebar) {
    console.error(`[UI] [${source}] Elementos da sidebar nao encontrados no DOM!`);
    return;
  }

  const isExpanded = !!expanded;
  tab.hidden = isExpanded;
  sidebar.hidden = !isExpanded;
  
  console.log(`[UI] [${source}] Sidebar state set:`, isExpanded ? 'EXPANDED' : 'COLLAPSED');
  
  if (isExpanded) {
    const input = $('search-input');
    if (input) setTimeout(() => input.focus(), 50);
  }
}

function setupSidebar() {
  api.onSidebarToggled((expanded) => setSidebarState(expanded, 'IPC_EVENT'));

  const tab = $('collapsed-tab');
  tab.addEventListener('mousedown', (event) => {
    isDragging = true;
    dragStartY = event.screenY;
    dragMoved = false;
    tab.classList.add('dragging');
    event.preventDefault();
  });

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    const deltaY = event.screenY - dragStartY;
    if (Math.abs(deltaY) > 10) {
      dragMoved = true;
      dragStartY = event.screenY;
      api.moveTag(deltaY);
    }
  });

  const stopDragging = () => {
    if (isDragging) {
      if (!dragMoved) {
        api.toggleSidebar();
      } else {
        api.saveTagPosition();
      }
    }
    isDragging = false;
    dragMoved = false;
    tab.classList.remove('dragging');
  };

  window.addEventListener('mouseup', stopDragging);
  window.addEventListener('blur', () => {
    isDragging = false;
    dragMoved = false;
    tab.classList.remove('dragging');
  });
  document.addEventListener('mouseleave', () => {
    if (isDragging) stopDragging();
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
  try {

  console.log('[UI] Initializing...');
  setupSidebar(); console.log('[UI] Sidebar setup done');
  setupNotifications(); console.log('[UI] Notifications setup done');
  setupNavigation({ 
    onOpenClient: openClient, 
    onOpenWhatsApp: openWhatsApp 
  });
  setupSearch(openClient); console.log('[UI] Search setup done');
  setupCorrections();
  setupFeedback(); console.log('[UI] Feedback setup done');
  
  const expanded = await api.getSidebarState();
  setSidebarState(expanded, 'INIT');

  updateNavAlerts();
  setInterval(updateNavAlerts, 60000);

  } catch (e) {
    console.error('[UI] Init failed:', e);
    // Fallback: Try to show collapsed sidebar at least
    try { setSidebarState(false, 'FATAL_FALLBACK'); } catch(e2) {}
  }
})();

document.addEventListener('visibilitychange', () => {
  console.log('[UI] Visibility changed:', document.visibilityState);
  if (document.visibilityState === 'visible') {
    api.getSidebarState().then(expanded => setSidebarState(expanded, 'VISIBILITY_CHANGE'));
  }
});
