const FIELD_CONFIG = Object.freeze({
  cdchamada: { table: 'pessoas', label: 'Codigo', max: 40 },
  nmpessoa: { table: 'pessoas', label: 'Nome', max: 200 },
  nmcurto: { table: 'pessoas', label: 'Apelido', max: 120 },
  nrcgc_cic: { table: 'pessoas', label: 'CPF/CNPJ', max: 30 },
  email: { table: 'pessoas', label: 'E-mail', type: 'email', max: 180 },
  email2: { table: 'pessoas', label: 'E-mail 2', type: 'email', max: 180 },
  nrpager: { table: 'pessoas', label: 'Celular', type: 'phone', max: 30 },
  nrtelefone: { table: 'pessoas', label: 'Telefone', type: 'phone', max: 30 },
  campostelwhatsapp: { table: 'pessoas', label: 'WhatsApp', type: 'phone', max: 30 },
  nmendereco: { table: 'pessoas', label: 'Endereco', max: 180 },
  nrlogradouro: { table: 'pessoas', label: 'Numero', max: 30 },
  dscomplemento: { table: 'pessoas', label: 'Complemento', max: 120 },
  nmbairro: { table: 'pessoas', label: 'Bairro', max: 120 },
  nmcidade: { table: 'pessoas', label: 'Cidade', max: 120 },
  iduf: { table: 'pessoas', label: 'UF', type: 'uf', max: 2 },
  nmcep: { table: 'pessoas', label: 'CEP', type: 'cep', max: 12 },
  idtabela: { table: 'pessoas', label: 'Tabela de preco', type: 'id', max: 40 },
  dtdatanasc: { table: 'crediar', label: 'Nascimento', type: 'date', max: 10 },
  sexo: { table: 'crediar', label: 'Sexo', max: 20 },
  dsnatural: { table: 'crediar', label: 'Naturalidade', max: 120 },
  convenio_terapeuta: { table: 'ecossistema', label: 'Convenio', type: 'id', max: 40 },
  convenio_terapeuta_nome: { table: 'ecossistema', label: 'Convenio nome', max: 200, enqueue: false }
});

function normalizeId(value, fieldName = 'id') {
  const id = String(value || '').trim();
  if (!id || id.length > 40) throw new Error(`${fieldName} invalido`);
  return id;
}

function normalizeDateInput(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const compact = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) return `${compact[3]}-${compact[2]}-${compact[1]}`;

  throw new Error('Data invalida. Use DD/MM/AAAA ou AAAA-MM-DD.');
}

function normalizeFieldValue(config, value) {
  let text = value == null ? '' : String(value).trim();
  if (config.type === 'date') text = normalizeDateInput(text);
  if (config.type === 'uf') text = text.toUpperCase();
  if ((config.type === 'phone' || config.type === 'cep') && text) text = text.replace(/\D/g, '');
  if (config.type === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error(`${config.label} invalido`);
  }
  if (text.length > config.max) throw new Error(`${config.label} excede ${config.max} caracteres`);
  return text;
}

function normalizeCorrectionPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload invalido');
  const idpessoa = normalizeId(payload.idpessoa, 'idpessoa');
  const changes = Array.isArray(payload.changes) ? payload.changes : [payload];
  if (changes.length === 0 || changes.length > 5) throw new Error('Quantidade de alteracoes invalida');

  return {
    idpessoa,
    nomePessoa: String(payload.nomePessoa || '').trim().slice(0, 200),
    origem: String(payload.origem || 'MANUAL').trim().slice(0, 50),
    criadoPor: String(payload.criadoPor || 'vendedor').trim().slice(0, 100),
    motivo: String(payload.motivo || 'Correcao de cadastro').trim().slice(0, 500),
    changes: changes.map((change) => {
      const campo = String(change.campo || '').trim();
      const config = FIELD_CONFIG[campo];
      if (!config) throw new Error(`Campo nao permitido: ${campo}`);

      const tabelaOrigem = String(change.tabelaOrigem || config.table).trim();
      if (tabelaOrigem !== config.table) {
        throw new Error(`Tabela invalida para ${campo}: ${tabelaOrigem}`);
      }

      return {
        campo,
        tabelaOrigem,
        valorOriginal: change.valorOriginal == null ? '' : String(change.valorOriginal),
        valorNovo: normalizeFieldValue(config, change.valorNovo),
        enfileirar: change.enfileirar !== false && config.enqueue !== false
      };
    })
  };
}

function dateParts(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  }
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return null;
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
}

function isBirthdayToday(value) {
  const parts = dateParts(value);
  if (!parts) return false;
  const today = new Date();
  return parts.month === today.getMonth() + 1 && parts.day === today.getDate();
}

function daysSince(value) {
  if (!value) return 365;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 365;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - dt) / 86400000));
}

function hoursSince(value) {
  if (!value) return 0;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / 3600000));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSearchTokens(query) {
  return String(query || '')
    .trim()
    .toLowerCase()
    .slice(0, 120)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  FIELD_CONFIG,
  normalizeId,
  normalizeDateInput,
  normalizeFieldValue,
  normalizeCorrectionPayload,
  dateParts,
  isBirthdayToday,
  daysSince,
  hoursSince,
  clampScore,
  normalizeSearchTokens,
  readNumber
};
