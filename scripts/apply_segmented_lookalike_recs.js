const { ecoPool } = require('../src/main/db');

async function applySegmentedLookalikeRecs() {
  console.log('[ML-RECS] Aplicando recomendações de "Lookalike" segmentadas...');
  
  try {
    const segments = {
      'Masculino': ['01000KRYJG', '01000FXF0I', '0100B5RE0X'],
      'Feminino': ['01000E0HFX', '01000CD901', '0100B5RE0X'],
      'Corporate': ['01000AYE5G', '01000FLBGS', '0100B5RE0X']
    };

    const client = await ecoPool.raw.connect();
    try {
      await client.query('BEGIN');
      let totalCreated = 0;

      for (const segmentName in segments) {
        const topProds = segments[segmentName];
        
        // Identify Lookalike clients for this segment (Sorocaba + NOT A/B + Segment match)
        let query = '';
        let params = [];
        
        if (segmentName === 'Corporate') {
          query = "SELECT p.idpessoa FROM ml_client_profiles p LEFT JOIN ranking_cache r ON r.idpessoa = p.idpessoa WHERE p.cidade = 'Sorocaba' AND (r.abc IS NULL OR r.abc = 'C') AND p.sttipopessoa = 'C'";
        } else {
          query = "SELECT p.idpessoa FROM ml_client_profiles p LEFT JOIN ranking_cache r ON r.idpessoa = p.idpessoa WHERE p.cidade = 'Sorocaba' AND (r.abc IS NULL OR r.abc = 'C') AND p.sexo = $1";
          params = [segmentName];
        }

        const lookalikesRes = await client.query(query, params);
        const ids = lookalikesRes.rows.map(r => r.idpessoa);
        
        console.log(`[ML-RECS] Segmento ${segmentName}: ${ids.length} clientes encontrados.`);

        for (const idp of ids) {
          for (const idprod of topProds) {
            await client.query(`
              INSERT INTO ml_product_affinity (idpessoa, idproduto, affinity_score, reason_code)
              VALUES ($1, $2, 75.00, $3)
              ON CONFLICT (idpessoa, idproduto) DO UPDATE SET
                affinity_score = EXCLUDED.affinity_score,
                reason_code = EXCLUDED.reason_code,
                calculado_em = CURRENT_TIMESTAMP
              WHERE ml_product_affinity.reason_code = 'LOOKALAKE_POPULAR_IN_REGION' OR ml_product_affinity.affinity_score < 75
            `, [idp, idprod, `LOOKALAKE_POPULAR_${segmentName.toUpperCase()}`]);
            totalCreated++;
          }
        }
      }

      await client.query('COMMIT');
      console.log(`[ML-RECS] Ingestão concluída: ${totalCreated} recomendações segmentadas atualizadas.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[ML-RECS] Erro fatal:', err.message);
  } finally {
    if (ecoPool.raw) await ecoPool.raw.end();
  }
}

applySegmentedLookalikeRecs();
