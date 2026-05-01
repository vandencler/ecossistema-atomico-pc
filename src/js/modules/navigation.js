import { $, create } from '../utils.js';
import { loadBirthdayModule } from '../ui/aniversarios.js';
import { loadSavQueue } from '../ui/sav.js';
import { loadSyncModule } from '../ui/sync.js';
import { loadConfigModule } from '../ui/config.js';
import { loadHealthModule } from '../ui/health.js';
import { api } from '../api.js';

let currentCallbacks = {};

export function setupNavigation(callbacks) {
  currentCallbacks = callbacks;
  const { onOpenClient, onOpenWhatsApp } = callbacks;

  document.querySelectorAll('.nav-btn[data-module]').forEach((button) => {
    button.addEventListener('click', () => switchModule(button.dataset.module, onOpenClient, onOpenWhatsApp));
  });

  document.querySelectorAll('.tab-btn[data-tab]').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab, button));
  });

  $('birthday-refresh')?.addEventListener('click', () => loadBirthdayModule(onOpenClient));
  $('sav-refresh')?.addEventListener('click', () => loadSavQueue(onOpenClient, onOpenWhatsApp));
  $('sync-refresh')?.addEventListener('click', () => loadSyncModule());
  $('health-refresh')?.addEventListener('click', () => loadHealthModule());
}

export function navigateTo(moduleName) {
  switchModule(moduleName, currentCallbacks.onOpenClient, currentCallbacks.onOpenWhatsApp);
}

export async function updateNavAlerts() {
  try {
    const alerts = await api.getNavigationAlerts();
    const savBtn = document.querySelector('.nav-btn[data-module="sav"]');
    if (!savBtn) return;

    let b = savBtn.querySelector('.nav-badge');
    if (!b) {
      b = create('span', { className: 'nav-badge' });
      savBtn.appendChild(b);
    }

    if (alerts.sav.count > 0) {
      b.textContent = alerts.sav.count;
      b.hidden = false;
      b.classList.toggle('urgent', alerts.sav.urgent > 0);
    } else {
      b.hidden = true;
    }
  } catch (e) {
    console.error('Falha ao atualizar alertas:', e.message);
  }
}

export function switchModule(name, onOpenClient, onOpenWhatsApp) {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.module === name);
  });
  document.querySelectorAll('.module').forEach((module) => {
    module.hidden = module.id !== `mod-${name}`;
  });

  if (name === 'aniversarios') loadBirthdayModule(onOpenClient);
  if (name === 'sav') loadSavQueue(onOpenClient, onOpenWhatsApp);
  if (name === 'sync') loadSyncModule();
  if (name === 'config') loadConfigModule();
  if (name === 'health') loadHealthModule();
}

export function switchTab(name, sourceButton) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  if (sourceButton) sourceButton.classList.add('active');
  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.hidden = tab.id !== `tab-${name}`;
  });
}
