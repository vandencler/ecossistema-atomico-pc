-- Migration 001: Initial Schema
CREATE TABLE IF NOT EXISTS client_cache (
  idpessoa TEXT PRIMARY KEY,
  nmpessoa TEXT,
  nmcurto TEXT,
  nrcgc_cic TEXT,
  dtultimacompra TEXT,
  last_cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buffered_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idpessoa TEXT NOT NULL,
  campo TEXT NOT NULL,
  valor_novo TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS local_config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);
