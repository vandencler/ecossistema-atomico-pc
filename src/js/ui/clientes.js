import { $, create, setChildren, textValue, phoneDisplay, fmtDate, fmtMoney, parseDateParts, rawDate, validPhoneDigits, stateMessage, badge } from '../utils.js';
import { api } from '../api.js';

const HEADER_FIELDS = new Set(['nmpessoa', 'nmcurto', 'nrpager', 'nrtelefone', 'campostelwhatsapp', 'email', 'dtdatanasc', 'sexo', 'idtabela']);
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
    create('button', { className: 'ch-back', type: 'button', text: '< Voltar a busca', onClick: onBack }),
    create('div', { className: 'ch-name', text: textValue(profile.nmpessoa, 'Cliente sem nome') })
  ];

  if (birthday.status === 'today' || birthday.status === 'week') {
    children.push(create('div', {
      className: birthday.status === 'today' ? 'birthday-alert today' : 'birthday-alert week',
      text: birthday.status === 'today' ? 'Parabens! Hoje e o aniversario.' : 'Aniversario nos proximos dias.'
    }));
  }

  const badges = [];
  if (profile.sttipopessoa === 'C') badges.push(badge('Cliente', 'badge-cliente'));
  if (profile.sttipopessoa === 'F') badges.push(badge('Fornecedor', 'badge-fornecedor'));
  badges.push(badge(`ABC: ${abc} #${textValue(rank?.posicao)}/${textValue(rank?.total_clientes)}`, `badge-abc-${abc.toLowerCase()}`));
  if (priority?.score) {
    const scoreColor = priority.score >= 80 ? 'badge-high' : priority.score >= 60 ? 'badge-med' : 'badge-low';
    badges.push(badge(`Prioridade: ${priority.score}`, scoreColor));
  }
  if (profile.sexo) badges.push(badge(profile.sexo, 'badge-info'));
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
    ['Lifetime', `R$ ${fmtMoney(stats.valor_lifetime)}`, `${stats.total_compras || 0} compras`, 'green'],
    ['Ticket Medio', `R$ ${fmtMoney(stats.ticket_medio)}`, '', 'cyan'],
    ['Frequencia', freq, '', 'purple'],
    ['Idade hoje', birthday.age !== null ? String(birthday.age) : '-', birthday.age !== null ? 'anos' : '', 'orange']
  ];

  setChildren($('client-stats'), cards.map(([label, value, sub, tone]) => (
    create('div', { className: 'cs-card' }, [
      create('div', { className: 'cs-label', text: label }),
      create('div', { className: `cs-value ${tone}`, text: value }),
      create('div', { className: 'cs-sub', text: sub })
    ])
  )));
}

export function renderPurchases(rows) {
  if (rows.length === 0) {
    setChildren($('tab-compras'), stateMessage('Sem compras registradas', 'muted'));
    return;
  }

  setChildren($('tab-compras'), rows.map((row) => create('div', { className: 'purchase-row' }, [
    create('span', { className: 'pr-date', text: fmtDate(row.dtemissao) }),
    create('span', { className: 'pr-nf', text: row.nrnotafiscal ? `NF ${row.nrnotafiscal}` : '' }),
    create('span', { className: 'pr-value', text: `R$ ${fmtMoney(row.vltotal)}` })
  ])));
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

  setChildren(target, rows.map((row) => create('div', { className: 'rec-row' }, [
    create('div', { className: 'rec-name', text: textValue(row.nmproduto) }),
    create('div', {
      className: 'rec-reason',
      text: `${textValue(row.nmgrupo, 'Sem grupo')} - ${row.clientes_similares || 0} clientes similares compraram`
    })
  ])));
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
      valueChildren.push(create('span', {
        className: `field-status field-status-${status.toLowerCase()}`,
        title: actionStatus[item.field]?.erro_msg || '',
        text: FIELD_STATUS_LABELS[status] || status
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
