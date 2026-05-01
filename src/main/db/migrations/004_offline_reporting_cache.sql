-- Migration 004: Offline Reporting Cache
-- Stores purchase history and top products for offline PDF/Excel generation.

CREATE TABLE IF NOT EXISTS last_purchases_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idpessoa TEXT NOT NULL,
  iddocumento TEXT,
  nrdocumento TEXT,
  vltotal REAL,
  aldesconto REAL,
  vldesconto REAL,
  usuario TEXT,
  dsobservacao TEXT,
  dtemissao TEXT,
  nrnotafiscal TEXT,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS top_products_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idpessoa TEXT NOT NULL,
  nmproduto TEXT,
  cdchamada TEXT,
  qtd_total REAL,
  valor_total REAL,
  vezes_comprado INTEGER,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_last_purchases_pessoa ON last_purchases_cache(idpessoa);
CREATE INDEX IF NOT EXISTS idx_top_products_pessoa ON top_products_cache(idpessoa);
