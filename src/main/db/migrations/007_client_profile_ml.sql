-- Migration 007 (Revised): Client Profile ML Storage
-- Creates a dedicated table for demographic and credit features to avoid permission issues with ALTER TABLE

CREATE TABLE IF NOT EXISTS ml_client_profiles (
    idpessoa VARCHAR(40) PRIMARY KEY,
    sexo VARCHAR(20),
    data_nascimento DATE,
    cidade VARCHAR(100),
    uf VARCHAR(2),
    stcredbloqueado BOOLEAN DEFAULT FALSE,
    sttipopessoa VARCHAR(2),
    dtcadastro DATETIME,
    calculado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ml_profiles_geo ON ml_client_profiles(uf, cidade);
