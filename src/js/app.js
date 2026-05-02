
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
import { MaintenanceBanner } from './ui/components.js';

let isDragging = false;
let dragStartY = 0;
let dragMoved = false;
let currentSidebarState = null;

async function checkSystemHealth() {
  try {
    const health = await api.getHealth();
    const content = $('module-content');
    
    // Remove existing banner
    content.querySelector('.maintenance-banner')?.remove();

    if (health.status !== 'HEALTHY') {
      let message = 'Atenção: O sistema está operando em modo degradado.';
      if (health.databases.mirror.status !== 'OK') {
        message = 'Conexão com o banco de dados ERP instável. Algumas informações podem não estar disponíveis.';
      } else if (!health.databases.mirror.indexesOptimized) {
        message = 'Busca do ERP operando em modo lento (índices ausentes). Evite termos muito genéricos.';
      }

      const banner = MaintenanceBanner(message, { closable: true });
      content.insertBefore(banner, content.firstChild);
    }
  } catch (e) {
    console.warn('[UI] Falha ao verificar saúde do sistema:', e);
  }
}

function setSidebarState(expanded, source = 'unknown') {
  const tab = $('collapsed-tab');
  const sidebar = $('sidebar');
  
  if (!tab || !sidebar) {
    console.error(`[UI] [${source}] Elementos da sidebar nao encontrados no DOM!`);
    return;
  }

  // Cast to boolean and deduplicate
  const isExpanded = !!expanded;
  if (currentSidebarState === isExpanded && source !== 'INIT' && source !== 'FATAL_FALLBACK') {
    console.log(`[UI] [${source}] Sidebar state already ${isExpanded ? 'EXPANDED' : 'COLLAPSED'}, skipping update.`);
    return;
  }

  currentSidebarState = isExpanded;
  tab.hidden = isExpanded;
  sidebar.hidden = !isExpanded;
  
  console.log(`[UI] [${source}] Sidebar state set:`, isExpanded ? 'EXPANDED' : 'COLLAPSED', `(Width: ${window.innerWidth}px)`);
  
  if (isExpanded) {
    const input = $('search-input');
    if (input) setTimeout(() => input.focus(), 50);
  }
}

function setupSidebar() {
  api.onSidebarToggled((expanded) => {
    console.log('[UI] Received sidebar-toggled event:', expanded);
    setSidebarState(expanded, 'IPC_EVENT');
  });

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

async function init() {
  try {
    console.log('[UI] Initializing...');
    
    // Ensure we have the latest state from main
    setupSidebar(); 
    setupNotifications();
    setupNavigation({ 
      onOpenClient: openClient, 
      onOpenWhatsApp: openWhatsApp 
    });
    setupSearch(openClient); 
    setupCorrections();
    setupFeedback(); 
    
    checkSystemHealth();
    
    const expanded = await api.getSidebarState();
    setSidebarState(expanded, 'INIT');

    updateNavAlerts();
    setInterval(updateNavAlerts, 60000);

  } catch (e) {
    console.error('[UI] Init failed:', e);
    try { setSidebarState(false, 'FATAL_FALLBACK'); } catch(_e2) {}
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('[UI] Visibility visible, re-syncing state...');
    api.getSidebarState().then(expanded => setSidebarState(expanded, 'VISIBILITY_CHANGE'));
  }
});
