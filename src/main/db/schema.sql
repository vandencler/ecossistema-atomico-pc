-- Schema for the ECOSYSTEM database (ECOSSISTEMA_ATOMICO)
-- This database tracks local corrections, action queues, and application state.

-- Table for tracking field-level corrections
CREATE TABLE IF NOT EXISTS correcoes_campos (
    idpessoa VARCHAR(40) NOT NULL,
    campo VARCHAR(64) NOT NULL,
    tabela_origem VARCHAR(64) NOT NULL,
    valor_original TEXT,
    valor_corrigido TEXT,
    corrigido_por VARCHAR(100),
    corrigido_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sincronizado BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (idpessoa, campo)
);

-- Table for the Action Queue (SAV - Serviço de Atendimento ao Vendedor)
CREATE TABLE IF NOT EXISTS acoes_pendentes (
    id SERIAL PRIMARY KEY,
    entidade VARCHAR(40) DEFAULT 'cliente',
    id_entidade VARCHAR(80),
    idpessoa VARCHAR(40) NOT NULL,
    nome_pessoa VARCHAR(200),
    tipo_acao VARCHAR(50) DEFAULT 'ALTERAR_CAMPO',
    campo VARCHAR(64),
    valor_anterior TEXT,
    valor_novo TEXT,
    motivo TEXT,
    origem VARCHAR(50) DEFAULT 'MANUAL',
    criado_por VARCHAR(100),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, APROVADO, REJEITADO, EM_EXECUCAO, CONCLUIDO, ERRO, CANCELADO
    aprovado_por VARCHAR(100),
    aprovado_em TIMESTAMP WITH TIME ZONE,
    rejeitado_por VARCHAR(100),
    rejeitado_em TIMESTAMP WITH TIME ZONE,
    executado_por VARCHAR(100),
    execucao_iniciada_em TIMESTAMP WITH TIME ZONE,
    erro_msg TEXT,
    executado_em TIMESTAMP WITH TIME ZONE,
    lote_id INTEGER
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'executado_em'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN executado_em TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'lote_id'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN lote_id INTEGER;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'entidade'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN entidade VARCHAR(40) DEFAULT 'cliente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'id_entidade'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN id_entidade VARCHAR(80);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'aprovado_por'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN aprovado_por VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'aprovado_em'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN aprovado_em TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'rejeitado_por'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN rejeitado_por VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'rejeitado_em'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN rejeitado_em TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'executado_por'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN executado_por VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'execucao_iniciada_em'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN execucao_iniciada_em TIMESTAMP WITH TIME ZONE;
    END IF;

    UPDATE acoes_pendentes
    SET entidade = COALESCE(NULLIF(entidade, ''), 'cliente'),
        id_entidade = COALESCE(NULLIF(id_entidade, ''), idpessoa)
    WHERE entidade IS NULL
       OR entidade = ''
       OR id_entidade IS NULL
       OR id_entidade = '';
END $$;

CREATE TABLE IF NOT EXISTS acoes_historico (
    id SERIAL PRIMARY KEY,
    acao_id INTEGER NOT NULL,
    status_anterior VARCHAR(20),
    status_novo VARCHAR(20) NOT NULL,
    usuario VARCHAR(100) DEFAULT 'sistema',
    motivo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for centralized logging
CREATE TABLE IF NOT EXISTS log_eventos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    idpessoa VARCHAR(40),
    detalhe TEXT,
    usuario VARCHAR(100) DEFAULT 'sistema',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for telemetry and usage metrics
CREATE TABLE IF NOT EXISTS telemetry_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    payload JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id UUID DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_name ON telemetry_events(event_name);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_occurred_at ON telemetry_events(occurred_at);

-- Cache for client ranking to avoid heavy on-the-fly calculations
CREATE TABLE IF NOT EXISTS ranking_cache (
    idpessoa VARCHAR(40) PRIMARY KEY,
    posicao INTEGER,
    total_clientes INTEGER,
    total_compras DECIMAL(15,2),
    abc CHAR(1),
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for system configurations
CREATE TABLE IF NOT EXISTS config_sistema (
    chave VARCHAR(64) PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial config
INSERT INTO config_sistema (chave, valor, descricao)
VALUES 
  ('ranking_cache_ttl_hours', '24', 'Tempo de vida do cache de ranking (em horas)'),
  ('auto_sync_interval_minutes', '10', 'Intervalo entre sincronizações automáticas (em minutos)'),
  ('auto_sync_enabled', 'true', 'Habilitar sincronização automática em segundo plano (true/false)'),
  ('sav_urgency_hours', '4', 'Horas de espera para marcar uma ação SAV manual como urgente'),
  ('notifications_enabled', 'true', 'Habilitar notificações desktop (true/false)'),
  ('notifications_sav_new', 'true', 'Notificar sobre novas ações SAV (true/false)')
ON CONFLICT (chave) DO NOTHING;

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_acoes_pending_unique ON acoes_pendentes(idpessoa, campo) WHERE status = 'PENDENTE';
CREATE UNIQUE INDEX IF NOT EXISTS idx_acoes_pending_entity_unique ON acoes_pendentes(entidade, id_entidade, campo) WHERE status = 'PENDENTE';
CREATE INDEX IF NOT EXISTS idx_acoes_status ON acoes_pendentes(status) WHERE status = 'PENDENTE';
CREATE INDEX IF NOT EXISTS idx_acoes_status_all ON acoes_pendentes(status);
CREATE INDEX IF NOT EXISTS idx_acoes_entidade ON acoes_pendentes(entidade, id_entidade);
CREATE INDEX IF NOT EXISTS idx_acoes_historico_acao ON acoes_historico(acao_id);
CREATE INDEX IF NOT EXISTS idx_correcoes_pessoa ON correcoes_campos(idpessoa);
CREATE INDEX IF NOT EXISTS idx_acoes_pessoa ON acoes_pendentes(idpessoa);
