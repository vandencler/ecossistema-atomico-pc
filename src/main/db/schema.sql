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

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'acoes_pendentes'
          AND column_name = 'revisando_por'
    ) THEN
        ALTER TABLE acoes_pendentes ADD COLUMN revisando_por VARCHAR(100);
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
-- Tracks significant system events, user actions, and background process status.
CREATE TABLE IF NOT EXISTS log_eventos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    idpessoa VARCHAR(40), -- Optional: related person ID
    detalhe TEXT,         -- Human-readable detail or JSON payload
    usuario VARCHAR(100) DEFAULT 'sistema',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for telemetry and usage metrics
-- High-volume table for UI interactions, performance markers, and session tracking.
CREATE TABLE IF NOT EXISTS telemetry_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    payload JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id UUID DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_name ON telemetry_events(event_name);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_occurred_at ON telemetry_events(occurred_at);

-- Table for Enriched Client Data
-- Stores application-specific metadata, interaction history, and scores.
CREATE TABLE IF NOT EXISTS clientes_enriquecidos (
    idpessoa VARCHAR(40) PRIMARY KEY,
    tags TEXT[],
    notas TEXT,
    ultima_interacao TIMESTAMP WITH TIME ZONE,
    canal_preferido VARCHAR(50),
    score_engajamento NUMERIC(5,2) DEFAULT 0.00,
    foto_url TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking Omnichannel Interactions
CREATE TABLE IF NOT EXISTS omnichannel_mensagens (
    id SERIAL PRIMARY KEY,
    idpessoa VARCHAR(40) NOT NULL,
    direcao VARCHAR(10) NOT NULL, -- INBOUND, OUTBOUND
    canal VARCHAR(20) DEFAULT 'WHATSAPP',
    conteudo TEXT,
    status VARCHAR(20), -- SENT, DELIVERED, READ, RECEIVED, ERROR
    external_id VARCHAR(100),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_omni_mensagens_pessoa ON omnichannel_mensagens(idpessoa);
CREATE INDEX IF NOT EXISTS idx_omni_mensagens_criado ON omnichannel_mensagens(criado_em);

-- Cache for client ranking to avoid heavy on-the-fly calculations
CREATE TABLE IF NOT EXISTS ranking_cache (
    idpessoa VARCHAR(40) PRIMARY KEY,
    posicao INTEGER,
    total_clientes INTEGER,
    total_compras DECIMAL(15,2),
    abc CHAR(1),
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ranking_cache_freshness ON ranking_cache(calculado_em DESC);

-- Table for system configurations
CREATE TABLE IF NOT EXISTS config_sistema (
    chave VARCHAR(64) PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking NPS surveys and scores
CREATE TABLE IF NOT EXISTS nps_scores (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    idpessoa VARCHAR(40), -- Linked person ID if available
    score INTEGER,
    comentario TEXT,
    status VARCHAR(20) DEFAULT 'SENT', -- SENT, RESPONDED, ERROR
    enviado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    respondido_em TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_nps_user_id ON nps_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_nps_status ON nps_scores(status);

-- Seed initial config
INSERT INTO config_sistema (chave, valor, descricao)
VALUES 
  ('ranking_cache_ttl_hours', '24', 'Tempo de vida do cache de ranking (em horas)'),
  ('auto_sync_interval_minutes', '10', 'Intervalo entre sincronizações automáticas (em minutos)'),
  ('auto_sync_enabled', 'true', 'Habilitar sincronização automática em segundo plano (true/false)'),
  ('sav_urgency_hours', '4', 'Horas de espera para marcar uma ação SAV manual como urgente'),
  ('notifications_enabled', 'true', 'Habilitar notificações desktop (true/false)'),
  ('notifications_sav_new', 'true', 'Notificar sobre novas ações SAV (true/false)'),
  ('omnichannel_whatsapp_enabled', 'false', 'Habilitar envio automático de mensagens WhatsApp (true/false)'),
  ('whatsapp_api_url', 'https://graph.facebook.com/v17.0/PHONE_NUMBER_ID/messages', 'URL da API do WhatsApp Business'),
  ('whatsapp_api_token', 'MOCK_TOKEN', 'Token de autenticação da API do WhatsApp'),
  ('nps_survey_enabled', 'true', 'Habilitar coleta automática de NPS (true/false)'),
  ('nps_survey_delay_days', '2', 'Dias de uso antes de disparar o primeiro NPS'),
  ('nps_survey_message', 'Olá! Você está usando o EAV há 48h. Em uma escala de 0 a 10, o quanto você recomendaria o sistema para um colega?', 'Mensagem do NPS')
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

-- New performance indexes for EAV-167
CREATE INDEX IF NOT EXISTS idx_acoes_pendentes_covering_queue ON acoes_pendentes (status, criado_em DESC, tipo_acao, origem, campo, entidade);
CREATE INDEX IF NOT EXISTS idx_acoes_pendentes_ordered_logic ON acoes_pendentes ((CASE status WHEN 'PENDENTE' THEN 1 WHEN 'APROVADO' THEN 2 WHEN 'ERRO' THEN 3 WHEN 'REJEITADO' THEN 4 WHEN 'CONCLUIDO' THEN 5 ELSE 9 END), criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_acoes_pending_stats_opt ON acoes_pendentes(tipo_acao, origem, criado_em) WHERE status = 'PENDENTE';

-- Trigger for Real-Time SAV Sync
CREATE OR REPLACE FUNCTION notify_sav_approved()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'APROVADO' AND OLD.status != 'APROVADO' THEN
    PERFORM pg_notify('sav_approved', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_sav_approved ON acoes_pendentes;
CREATE TRIGGER trg_notify_sav_approved
AFTER UPDATE OF status ON acoes_pendentes
FOR EACH ROW
EXECUTE PROCEDURE notify_sav_approved();

-- ML Integration Schema (Phase 2)
-- These tables receive pre-computed data from external ML pipelines.

CREATE TABLE IF NOT EXISTS ml_churn_risk (
    idpessoa VARCHAR(40) PRIMARY KEY,
    risk_score DECIMAL(5,2) DEFAULT 0.00, -- 0.00 to 100.00
    next_purchase_estimate DATE,
    confidence DECIMAL(5,2) DEFAULT 0.00,
    model_version VARCHAR(50),
    reason_code VARCHAR(100),
    reason_detail TEXT,
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ml_product_affinity (
    id SERIAL PRIMARY KEY,
    idpessoa VARCHAR(40) NOT NULL,
    idproduto VARCHAR(40) NOT NULL,
    affinity_score DECIMAL(5,2) DEFAULT 0.00, -- 0.00 to 100.00
    reason_code VARCHAR(50), -- e.g., 'BOUGHT_TOGETHER', 'SIMILAR_PROFILE'
    calculado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idpessoa, idproduto)
);

CREATE INDEX IF NOT EXISTS idx_ml_affinity_pessoa ON ml_product_affinity(idpessoa);
CREATE INDEX IF NOT EXISTS idx_ml_affinity_score ON ml_product_affinity(affinity_score DESC);

-- Table for Application Feedback (Manual UX Feedback)
CREATE TABLE IF NOT EXISTS app_feedback (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    satisfaction INTEGER, -- 1: Sad, 2: Neutral, 3: Happy
    comment TEXT,
    device_info JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking system health snapshots over time (EAV-177)
CREATE TABLE IF NOT EXISTS monitoring_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL, -- HEALTHY, DEGRADED, CRITICAL
    metrics JSONB NOT NULL,
    summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitoring_snapshot_time ON monitoring_snapshots(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_status ON monitoring_snapshots(status);

-- Table for Governed Production Writes (Purge Queue)
-- Tracks all automated write-backs to the Principal DB (.103)
CREATE TABLE IF NOT EXISTS purge_queue (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL, -- e.g., 'WAError_WRITEBACK'
    target_table VARCHAR(64) NOT NULL,
    target_id VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, ERROR
    error_msg TEXT,
    usuario VARCHAR(100) DEFAULT 'sistema',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processado_em TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_purge_status ON purge_queue(status);
CREATE INDEX IF NOT EXISTS idx_purge_type ON purge_queue(operation_type);

