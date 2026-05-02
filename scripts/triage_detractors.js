
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const { ecoPool } = require('../src/main/db');
const fs = require('fs');
const path = require('path');

/**
 * Detractor Triage Script
 * Specifically designed to support the CMO in identifying pilot users with negative sentiment.
 */

async function triageDetractors() {
  console.log('=== PILOT SENTIMENT TRIAGE (CMO SUPPORT) ===\n');
  
  try {
    const res = await ecoPool.query(`
      SELECT 
        idpessoa,
        sentimento,
        sentiment_score,
        conteudo as message,
        data_mensagem
      FROM v_sentimento_feedback
      WHERE sentimento = 'NEGATIVE'
      ORDER BY data_mensagem DESC
      LIMIT 10
    `);

    if (res.rowCount === 0) {
      console.log('🟢 No recent detractors identified. Sentiment is stable.');
    } else {
      console.log(`🔴 Identified ${res.rowCount} negative interactions:\n`);
      console.table(res.rows.map(r => ({
        User: r.idpessoa,
        Score: r.sentiment_score,
        Message: r.message.substring(0, 50) + (r.message.length > 50 ? '...' : ''),
        Date: r.data_mensagem
      })));
      
      console.log('\n--- RECOMMENDED ACTION ---');
      console.log('1. Verify if the user is a Power User (Monday 10-rep group).');
      console.log('2. Check Telemetry for IPC_TOGGLESIDEBAR frequency (likely Sidebar Bug).');
      console.log('3. Trigger manual reach-out if score < -0.5.');
    }

  } catch (err) {
    console.error('Error in triage:', err.message);
  } finally {
    process.exit(0);
  }
}

triageDetractors();
