import { $, create, setChildren, textValue, stateMessage, phoneDisplay, fmtDate } from '../utils.js';
import { api } from '../api.js';

function renderBirthdayList(targetId, rows, emptyText, onOpenClient) {
  const target = $(targetId);
  if (!rows || rows.length === 0) {
    setChildren(target, stateMessage(emptyText, 'muted'));
    return;
  }

  setChildren(target, rows.map((row) => {
    const meta = [
      `Data: ${fmtDate(row.aniversario_ano)}`,
      phoneDisplay(row.campostelwhatsapp) || phoneDisplay(row.nrpager) || phoneDisplay(row.nrtelefone),
      row.email
    ].filter(Boolean);

    return create('button', {
      className: 'birthday-row',
      type: 'button',
      onClick: () => onOpenClient(row.idpessoa)
    }, [
      create('div', { className: 'birthday-name', text: textValue(row.nmpessoa, 'Cliente sem nome') }),
      create('div', { className: 'birthday-meta' }, meta.map((item) => create('span', { text: item })))
    ]);
  }));
}

export async function loadBirthdayModule(onOpenClient) {
  const todayEl = $('birthday-today');
  const weekEl = $('birthday-week');
  if (!todayEl || !weekEl) return;

  setChildren(todayEl, stateMessage('Carregando...', 'muted'));
  setChildren(weekEl, stateMessage('Carregando...', 'muted'));

  const data = await api.birthdayCustomers();
  if (data.error) {
    setChildren(todayEl, stateMessage(`Erro: ${data.error}`, 'error'));
    setChildren(weekEl, []);
    return;
  }

  const rows = data.rows || [];
  renderBirthdayList('birthday-today', rows.filter((row) => row.bucket === 'today'), 'Nenhum aniversario hoje', onOpenClient);
  renderBirthdayList('birthday-week', rows.filter((row) => row.bucket === 'week'), 'Nenhum aniversario no restante da semana', onOpenClient);
}
