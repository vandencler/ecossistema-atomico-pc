import { $, create, setChildren, textValue, stateMessage, validPhoneDigits } from '../utils.js';
import { api } from '../api.js';
import { 
  renderClientHeader, 
  renderClientStats, 
  renderPurchases, 
  renderTopProducts, 
  loadRecommendations, 
  renderCadastro 
} from '../ui/clientes.js';
import { switchModule, switchTab } from './navigation.js';

let currentClient = null;

const TEMPLATES = [
  { label: 'Boas-vindas', msg: 'Ola {nome}! Tudo bem? Aqui e da Emporio Natural. Estamos com novidades para voce.' },
  { label: 'Aniversario', msg: 'Parabens {nome}! A Emporio Natural deseja um dia maravilhoso. Passe aqui para ganhar um presente especial.' },
  { label: 'Pos-venda', msg: 'Oi {nome}! Gostou dos produtos? Qualquer duvida estamos aqui. Emporio Natural.' },
  { label: 'Promocao', msg: 'Oi {nome}! Temos uma oferta especial para voce. Vem conferir.' },
  { label: 'Recompra', msg: 'Oi {nome}! Ja faz um tempinho que nao te vemos por aqui. Temos novidades que combinam com voce.' }
];

export async function openClient(id) {
  switchModule('clientes');
  setChildren($('search-results'), stateMessage('Carregando cliente...', 'muted'));

  const data = await api.clientDashboard(id);
  if (data.error) {
    setChildren($('search-results'), stateMessage(`Erro: ${data.error}`, 'error'));
    return;
  }

  currentClient = data;
  $('search-results').hidden = true;
  $('search-input').hidden = true;
  document.querySelector('.search-hint').hidden = true;
  $('client-dashboard').hidden = false;

  renderClientHeader(data.profile, data.ranking, backToSearch, data.priority);
  renderClientStats(data.stats, data.ranking, data.profile);
  renderPurchases(data.lastPurchases || []);
  renderTopProducts(data.topProducts || []);
  renderCadastro(data.profile, data.corrections || {}, data.actionStatus || {});
  renderWhatsApp(data.profile);
  switchTab('compras');
  loadRecommendations(id);
}

export function backToSearch() {
  $('client-dashboard').hidden = true;
  $('search-results').hidden = false;
  $('search-input').hidden = false;
  document.querySelector('.search-hint').hidden = false;
  $('search-input').focus();
  currentClient = null;
}

export function getCurrentClient() {
  return currentClient;
}

function firstName(profile) {
  return textValue(profile?.nmcurto || profile?.nmpessoa, '').split(/\s+/).filter(Boolean)[0] || 'cliente';
}

function preferredPhone(profile) {
  return validPhoneDigits(profile?.campostelwhatsapp) || validPhoneDigits(profile?.nrpager) || validPhoneDigits(profile?.nrtelefone);
}

export function renderWhatsApp(profile) {
  const phone = preferredPhone(profile);
  const target = $('whatsapp-bar');
  if (!phone) {
    setChildren(target, []);
    return;
  }

  const openButton = create('button', {
    className: 'wa-btn wa-btn-primary',
    type: 'button',
    text: `Abrir WhatsApp com ${firstName(profile)}`,
    onClick: () => openWhatsApp(phone)
  });

  const templates = create('div', { className: 'wa-templates' }, TEMPLATES.map((template, index) => create('button', {
    className: 'wa-tpl',
    type: 'button',
    text: template.label,
    onClick: () => openWhatsApp(phone, index)
  })));

  setChildren(target, [openButton, templates]);
}

export async function openWhatsApp(phone, templateIndex = null) {
  let message = '';
  if (typeof templateIndex === 'number' && TEMPLATES[templateIndex]) {
    message = TEMPLATES[templateIndex].msg.replace('{nome}', firstName(currentClient?.profile));
  }
  const result = await api.openWhatsApp({ phone, message });
  if (result?.error) alert(`Erro: ${result.error}`);
}
