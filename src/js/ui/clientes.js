import { $, create, setChildren, textValue, phoneDisplay, fmtDate, fmtMoney, parseDateParts, rawDate, stateMessage, toast } from '../utils.js';
import { api } from '../api.js';
import { StatusBadge, MetricCard, ActionGroup, IconButton, renderPurchaseRow } from './components.js';

const FIELD_STATUS_LABELS = {
  PENDENTE: 'SAV: Pendente',
  APROVADO: 'SAV: Aprovado',
  REJEITADO: 'SAV: Rejeitado',
  EM_EXECUCAO: 'SAV: Executando',
  CONCLUIDO: 'SAV: Concluido',
  ERRO: 'SAV: Erro',
  CANCELADO: 'SAV: Cancelado'
};

export function getBirthdayStatus(dateLike) {
  const parts = parseDateParts(dateLike);
  if (!parts) return { status: 'none', age: null, nascStr: '' };

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let age = today.getFullYear() - parts.year;
  const birthdayThisYear = new Date(today.getFullYear(), parts.month - 1, parts.day);
  if (birthdayThisYear > todayDate) age -= 1;

  const nextBirthday = birthdayThisYear >= todayDate
    ? birthdayThisYear
    : new Date(today.getFullYear() + 1, parts.month - 1, parts.day);
  const daysUntil = Math.round((nextBirthday - todayDate) / 86400000);
  const status = daysUntil === 0 ? 'today' : daysUntil <= 6 ? 'week' : 'none';

  return { status, age, nascStr: fmtDate(dateLike) };
}

export function renderClientHeader(profile, rank, onBack, priority) {
  const birthday = getBirthdayStatus(profile.dtdatanasc);
  const header = $('client-header');
  const abc = textValue(rank?.abc, '-').toUpperCase();

  const children = [
    ActionGroup([
      IconButton('Voltar a busca', onBack, { className: 'ch-back', icon: 'ROTATE_CCW' }),
      IconButton('PDF', async () => {
        const res = await api.exportClientData(profile.idpessoa, 'pdf');
        if (res.error) toast(`Erro: ${res.error}`, 'error');
        else if (!res.canceled) toast('PDF gerado com sucesso!', 'success');
      }, { className: 'ch-export-btn', icon: 'FILE_TEXT' }),
      IconButton('Excel', async () => {
        const res = await api.exportClientData(profile.idpessoa, 'excel');
        if (res.error) toast(`Erro: ${res.error}`, 'error');
        else if (!res.canceled) toast('Excel gerado com sucesso!', 'success');
      }, { className: 'ch-export-btn', icon: 'FILE_SPREADSHEET' })
    ], { className: 'ch-actions' }),
    create('div', { className: 'ch-name', text: textValue(profile.nmpessoa, 'Cliente sem nome') })
  ];

  if (birthday.status === 'today' || birthday.status === 'week') {
    children.push(create('div', {
      className: birthday.status === 'today' ? 'birthday-alert today' : 'birthday-alert week',
      text: birthday.status === 'today' ? 'Parabens! Hoje e o aniversario.' : 'Aniversario nos proximos dias.'
    }));
  }

  const badges = [];
  if (profile.sttipopessoa === 'C') badges.push(StatusBadge('Cliente', { type: 'success' }));
  if (profile.sttipopessoa === 'F') badges.push(StatusBadge('Fornecedor', { type: 'info' }));
  badges.push(StatusBadge(`ABC: ${abc} #${textValue(rank?.posicao)}/${textValue(rank?.total_clientes)}`, { type: 'info' }));
  if (priority?.score) {
    const scoreType = priority.score >= 80 ? 'error' : priority.score >= 60 ? 'warn' : 'info';
    badges.push(StatusBadge(`Prioridade: ${priority.score}`, { type: scoreType }));
  }
  if (profile.sexo) badges.push(StatusBadge(profile.sexo, { type: 'info' }));
  children.push(create('div', { className: 'ch-badges' }, badges));

  if (priority?.insights?.length > 0) {
    children.push(create('div', { className: 'ch-insights' }, 
      priority.insights.map(txt => create('span', { className: 'insight-tag', text: `✨ ${txt}` }))
    ));
  }

  const info = [
    birthday.nascStr ? `Nascimento: ${birthday.nascStr}${birthday.age !== null ? ` (${birthday.age} anos)` : ''}` : '',
    profile.nrcgc_cic ? `Doc: ${profile.nrcgc_cic}` : '',
    phoneDisplay(profile.campostelwhatsapp) ? `WhatsApp: ${phoneDisplay(profile.campostelwhatsapp)}` : '',
    phoneDisplay(profile.nrpager) ? `Cel: ${phoneDisplay(profile.nrpager)}` : '',
    phoneDisplay(profile.nrtelefone) ? `Tel: ${phoneDisplay(profile.nrtelefone)}` : '',
    profile.email ? `Email: ${profile.email}` : '',
    profile.tabela_preco ? `Tabela: ${profile.tabela_preco}` : ''
  ].filter(Boolean);
  children.push(create('div', { className: 'ch-info' }, info.map((item) => create('span', { text: item }))));

  setChildren(header, children);
}

export function renderClientStats(stats, rank, profile) {
  const birthday = getBirthdayStatus(profile?.dtdatanasc);
  const freq = stats.freq_dias > 0 ? `A cada ${Math.round(stats.freq_dias)} dias` : '-';
  
  const cards = [
    MetricCard('Lifetime', `R$ ${fmtMoney(stats.valor_lifetime)}`, { subValue: `${stats.total_compras || 0} compras`, type: 'success' }),
    MetricCard('Ticket Medio', `R$ ${fmtMoney(stats.ticket_medio)}`, { type: 'info' }),
    MetricCard('Frequencia', freq, { type: 'info' }),
    MetricCard('Idade hoje', birthday.age !== null ? String(birthday.age) : '-', { subValue: birthday.age !== null ? 'anos' : '', type: 'warn' })
  ];

  setChildren($('client-stats'), cards);
}

export function renderPurchases(rows) {
  if (rows.length === 0) {
    setChildren($('tab-compras'), stateMessage('Sem compras registradas', 'muted'));
    return;
  }

  setChildren($('tab-compras'), rows.map(renderPurchaseRow));
}

export function renderTopProducts(rows) {
  if (rows.length === 0) {
    setChildren($('tab-produtos'), stateMessage('Sem produtos', 'muted'));
    return;
  }

  setChildren($('tab-produtos'), rows.map((row) => create('div', { className: 'product-row' }, [
    create('span', { className: 'prd-name', text: textValue(row.nmproduto) }),
    create('span', { className: 'prd-qty', text: `${Math.round(Number(row.qtd_total || 0))}x` }),
    create('span', { className: 'prd-value', text: `R$ ${fmtMoney(row.valor_total)}` })
  ])));
}

export async function loadRecommendations(id) {
  const target = $('tab-recomendacoes');
  setChildren(target, stateMessage('Carregando sugestoes...', 'muted'));

  const data = await api.clientRecommendations(id);
  if (data.error) {
    setChildren(target, stateMessage(`Erro: ${data.error}`, 'error'));
    return;
  }

  const rows = data.rows || [];
  if (rows.length === 0) {
    setChildren(target, stateMessage('Sem sugestoes por enquanto', 'muted'));
    return;
  }

  setChildren(target, rows.map((row) => {
    let reasonText = `${textValue(row.nmgrupo, 'Sem grupo')}`;
    if (row.source === 'ML') {
      const mlLabel = row.reason === 'HIGH_HISTORICAL_VOLUME' ? 'Alta recorrência histórica' : 'Afinidade preditiva';
      reasonText += ` - ${mlLabel} ✨`;
    } else {
      reasonText += ` - ${row.clientes_similares || 0} clientes similares compraram`;
    }

    return create('div', { className: `rec-row rec-source-${(row.source || 'heuristic').toLowerCase()}` }, [
      create('div', { className: 'rec-name', text: textValue(row.nmproduto) }),
      create('div', { className: 'rec-reason', text: reasonText })
    ]);
  }));
}

function cadastroFields(profile, corrections) {
  const birthday = getBirthdayStatus(profile.dtdatanasc);
  return [
    { label: 'Codigo', display: profile.cdchamada, field: 'cdchamada', raw: profile.cdchamada, table: 'pessoas' },
    { label: 'Nome', display: profile.nmpessoa, field: 'nmpessoa', raw: profile.nmpessoa, table: 'pessoas' },
    { label: 'Apelido', display: profile.nmcurto, field: 'nmcurto', raw: profile.nmcurto, table: 'pessoas' },
    { label: 'CPF/CNPJ', display: profile.nrcgc_cic, field: 'nrcgc_cic', raw: profile.nrcgc_cic, table: 'pessoas' },
    { label: 'Tipo', display: profile.stpessoa },
    { label: 'Nascimento', display: birthday.nascStr, field: 'dtdatanasc', raw: rawDate(profile.dtdatanasc), table: 'crediar', tone: birthday.status },
    { label: 'Idade hoje', display: birthday.age !== null ? `${birthday.age} anos` : '-' },
    { label: 'Sexo', display: profile.sexo, field: 'sexo', raw: profile.sexo, table: 'crediar' },
    { label: 'Naturalidade', display: profile.dsnatural, field: 'dsnatural', raw: profile.dsnatural, table: 'crediar' },
    { label: 'E-mail', display: profile.email, field: 'email', raw: profile.email, table: 'pessoas' },
    { label: 'E-mail 2', display: profile.email2, field: 'email2', raw: profile.email2, table: 'pessoas' },
    { label: 'WhatsApp', display: phoneDisplay(profile.campostelwhatsapp), field: 'campostelwhatsapp', raw: profile.campostelwhatsapp, table: 'pessoas' },
    { label: 'Celular', display: phoneDisplay(profile.nrpager), field: 'nrpager', raw: profile.nrpager, table: 'pessoas' },
    { label: 'Telefone', display: phoneDisplay(profile.nrtelefone), field: 'nrtelefone', raw: profile.nrtelefone, table: 'pessoas' },
    { label: 'Endereco', display: profile.nmendereco, field: 'nmendereco', raw: profile.nmendereco, table: 'pessoas' },
    { label: 'Numero', display: profile.nrlogradouro, field: 'nrlogradouro', raw: profile.nrlogradouro, table: 'pessoas' },
    { label: 'Complemento', display: profile.dscomplemento, field: 'dscomplemento', raw: profile.dscomplemento, table: 'pessoas' },
    { label: 'Bairro', display: profile.nmbairro, field: 'nmbairro', raw: profile.nmbairro, table: 'pessoas' },
    { label: 'Cidade', display: profile.nmcidade, field: 'nmcidade', raw: profile.nmcidade, table: 'pessoas' },
    { label: 'UF', display: profile.iduf, field: 'iduf', raw: profile.iduf, table: 'pessoas' },
    { label: 'CEP', display: profile.nmcep, field: 'nmcep', raw: profile.nmcep, table: 'pessoas' },
    { label: 'Cadastro', display: fmtDate(profile.dtcadastro) },
    { label: 'Ultima compra', display: fmtDate(profile.dtultimacompra) },
    { label: 'Desconto padrao', display: profile.aldesconto ? `${profile.aldesconto}%` : '-' },
    { label: 'Tabela de preco', display: profile.tabela_preco, field: 'idtabela', raw: profile.idtabela, table: 'pessoas', type: 'select-tabela' },
    { label: 'Convenio', display: corrections.convenio_terapeuta_nome || '(nenhum)', field: 'convenio_terapeuta', raw: corrections.convenio_terapeuta || '', table: 'ecossistema', type: 'select-convenio' }
  ];
}

export function renderCadastro(profile, corrections = {}, actionStatus = {}) {
  const rows = cadastroFields(profile, corrections).map((item) => {
    const valueClasses = ['cf-value'];
    if (item.tone === 'today') valueClasses.push('green');
    if (item.tone === 'week') valueClasses.push('yellow');
    const status = item.field ? actionStatus[item.field]?.status : null;

    const valueChildren = [
      create('span', { className: valueClasses.join(' '), text: textValue(item.display) })
    ];

    if (item.field && corrections[item.field] !== undefined) {
      valueChildren.push(create('span', { className: 'correction-dot', title: 'Corrigido no Ecossistema', text: '●' }));
    }

    if (status) {
      valueChildren.push(StatusBadge(FIELD_STATUS_LABELS[status] || status, {
        type: status.toLowerCase(),
        title: actionStatus[item.field]?.erro_msg || ''
      }));
    }

    if (item.field) {
      valueChildren.push(create('button', {
        className: 'cf-edit',
        type: 'button',
        title: 'Editar',
        text: 'Editar',
        dataset: {
          campo: item.field,
          tabela: item.table,
          raw: item.raw || '',
          type: item.type || ''
        }
      }));
    }

    return create('div', { className: 'cadastro-field' }, [
      create('span', { className: 'cf-label', text: item.label }),
      create('span', { className: 'cf-value-wrap' }, valueChildren)
    ]);
  });

  setChildren($('tab-cadastro'), rows);
}
