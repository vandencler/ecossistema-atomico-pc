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
  if (value.trim().length < 2) {
    searchRequestId += 1;
    setChildren(container, []);
    return;
  }
  searchTimeout = setTimeout(() => doSearch(value, onOpenClient), 300);
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
