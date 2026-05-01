const { pool } = require('../src/main/db');

async function runDBA() {
  const client = await pool.connect();
  try {
    console.log('Iniciando otimizacao do DBA...');
    
    // Create roles if they don't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eav_reader') THEN
          CREATE ROLE eav_reader;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eav_writer') THEN
          CREATE ROLE eav_writer;
        END IF;
      END
      $$;
    `);

    await client.query(`CREATE SCHEMA IF NOT EXISTS wshop;`);
    
    // Create table se não existir para o ambiente local
    await client.query(`
      CREATE TABLE IF NOT EXISTS wshop.pessoas (
        id SERIAL PRIMARY KEY,
        nmpessoa VARCHAR(255),
        nmcurto VARCHAR(255),
        cdchamada VARCHAR(255),
        nrcgc_cic VARCHAR(255),
        campostelwhatsapp VARCHAR(255),
        nrtelefone VARCHAR(255)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wshop.crediar (
        id SERIAL PRIMARY KEY
      );
    `);

    console.log('Executando os comandos...');

    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await client.query(`GRANT SELECT ON wshop.pessoas TO eav_reader;`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_nmpessoa_trgm ON wshop.pessoas USING gin (LOWER(nmpessoa) gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_nmcurto_trgm ON wshop.pessoas USING gin (LOWER(nmcurto) gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_cdchamada_trgm ON wshop.pessoas USING gin (LOWER(cdchamada) gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_nrcgc_cic_trgm ON wshop.pessoas USING gin (LOWER(nrcgc_cic) gin_trgm_ops);`);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pessoas_telwa_trgm ON wshop.pessoas USING gin (
          REGEXP_REPLACE(COALESCE(campostelwhatsapp,''), '[^0-9]', '', 'g') gin_trgm_ops
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pessoas_phone_trgm ON wshop.pessoas USING gin (
          REGEXP_REPLACE(COALESCE(nrtelefone,''), '[^0-9]', '', 'g') gin_trgm_ops
      );
    `);

    await client.query(`ANALYZE wshop.pessoas;`);

    await client.query(`GRANT USAGE ON SCHEMA wshop TO eav_writer;`);
    await client.query(`GRANT USAGE ON SCHEMA wshop TO eav_reader;`);

    await client.query(`GRANT SELECT, UPDATE ON wshop.pessoas TO eav_writer;`);
    await client.query(`GRANT SELECT, UPDATE ON wshop.crediar TO eav_writer;`);

    await client.query(`GRANT SELECT ON wshop.pessoas TO eav_reader;`);
    await client.query(`GRANT SELECT ON wshop.crediar TO eav_reader;`);

    console.log('Comandos DBA executados com sucesso!');
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runDBA();
