import { $, setChildren, stateMessage } from '../utils.js';
import { api } from '../api.js';
import { renderSearchResult } from '../ui/components.js';

let searchTimeout = null;
let searchRequestId = 0;

export function setupSearch(onOpenClient) {
  const input = $('search-input');
  if (!input) return;

  input.addEventListener('input', (event) => {
    debounceSearch(event.target.value, onOpenClient);
  });
}

function debounceSearch(value, onOpenClient) {
  clearTimeout(searchTimeout);
  const container = $('search-results');
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    searchRequestId += 1;
    setChildren(container, []);
    return;
  }
  
  // Temporary throttling for legacy phone (nrpager) searches (EAV-157)
  const isNumeric = /\d/.test(trimmed);
  const delay = isNumeric ? 800 : 300;

  searchTimeout = setTimeout(() => doSearch(value, onOpenClient), delay);
}

async function doSearch(query, onOpenClient) {
  const requestId = ++searchRequestId;
  const container = $('search-results');
  setChildren(container, stateMessage('Buscando...', 'muted'));

  const result = await api.searchClient(query);
  if (requestId !== searchRequestId) return;

  if (result.error) {
    setChildren(container, stateMessage(`Erro: ${result.error}`, 'error'));
    return;
  }

  const rows = result.rows || [];
  if (rows.length === 0) {
    setChildren(container, stateMessage('Nenhum resultado', 'muted'));
    return;
  }

  setChildren(container, rows.map(row => renderSearchResult(row, onOpenClient)));
}
