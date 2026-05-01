const { pool } = require('../src/main/db');

const coreIndexes = [
  'idx_pessoas_nmpessoa_trgm', 
  'idx_pessoas_nmcurto_trgm', 
  'idx_pessoas_cdchamada_trgm', 
  'idx_pessoas_nrcgc_cic_trgm'
];

const splitPhoneIndexes = [
  'idx_pessoas_telwa_trgm',
  'idx_pessoas_phone_trgm'
];

const legacyPhoneIndex = 'idx_pessoas_phones_trgm';

async function check() {
  console.log('--- Verificando Índices de Busca (Trigram) no Mirror DB ---');
  try {
    const allExpected = [...coreIndexes, ...splitPhoneIndexes, legacyPhoneIndex];
    const res = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'pessoas' 
        AND indexname IN (${allExpected.map((_, i) => '$' + (i + 1)).join(',')})
    `, allExpected);

    const found = res.rows.map(r => r.indexname);
    
    // Check Core
    console.log('\n[Core Indexes]');
    coreIndexes.forEach(idx => {
      console.log(`${found.includes(idx) ? '✅' : '❌'} ${idx}`);
    });

    // Check Phone Optimization
    console.log('\n[Phone Optimization]');
    const hasSplit = splitPhoneIndexes.every(idx => found.includes(idx));
    const hasLegacy = found.includes(legacyPhoneIndex);

    splitPhoneIndexes.forEach(idx => {
      let status = found.includes(idx) ? '✅' : (hasLegacy ? '🟡 (legacy)' : '❌');
      console.log(`${status} ${idx}`);
    });

    if (hasLegacy && !hasSplit) {
      console.log(`✅ ${legacyPhoneIndex} (Legacy detectado)`);
    }

    const coreOk = coreIndexes.every(idx => found.includes(idx));
    const phoneOk = hasSplit || hasLegacy;

    console.log('\nStatus Final:', (coreOk && phoneOk) ? 'TOTALMENTE OTIMIZADO' : 'OTIMIZAÇÃO PARCIAL');

  } catch (e) {
    console.error('Erro ao verificar índices:', e.message);
  } finally {
    process.exit(0);
  }
}

check();