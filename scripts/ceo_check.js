const fs = require('fs');
const path = require('path');
const { pool, ecoPool } = require('../src/main/db');

async function main() {
  const issuesPath = path.join(__dirname, '..', 'issues.json');
  
  if (!fs.existsSync(issuesPath)) {
    console.error('Error: issues.json not found.');
    process.exit(1);
  }

  const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));

  console.log('\n================================================================');
  console.log('             ECOSSISTEMA ATÔMICO - CEO DASHBOARD');
  console.log('================================================================');
  console.log(`Status as of: ${new Date().toLocaleString()}`);
  console.log('----------------------------------------------------------------');

  // 1. Issue Status Section
  const statusIcons = {
    'todo': '⚪',
    'in_progress': '🔵',
    'in_review': '🟡',
    'blocked': '🔴',
    'completed': '🟢'
  };

  issues.forEach(issue => {
    const icon = statusIcons[issue.status] || '❓';
    console.log(`${icon} [${issue.id}] ${issue.title}`);
    console.log(`   Priority: ${issue.priority.toUpperCase()}`);
    console.log(`   Assignee: ${issue.assignee}`);
    console.log(`   Status:   ${issue.status.replace('_', ' ')}`);
    if (issue.blocked_by) {
      console.log(`   BLOCKED BY: ${issue.blocked_by}`);
    }
    if (issue.notes) {
      console.log(`   Note: ${issue.notes}`);
    }
    console.log('----------------------------------------------------------------');
  });

  const total = issues.length;
  const completed = issues.filter(i => i.status === 'completed').length;
  const blocked = issues.filter(i => i.status === 'blocked').length;
  
  console.log(`SUMMARY: ${completed}/${total} Completed, ${blocked} Blocked.`);
  console.log('================================================================');

  // 2. Technical Integrity Section
  console.log('\n================================================================');
  console.log('             TECHNICAL INTEGRITY (CTO METRICS)');
  console.log('================================================================');
  
  try {
    // DB Checks
    const mirrorOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
    const ecoOk = await ecoPool.query('SELECT 1').then(() => true).catch(() => false);

    console.log(`[DB] Mirror Database (Alterdata):    ${mirrorOk ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);
    console.log(`[DB] Ecosystem Database (Local):     ${ecoOk ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);

    // ML Checks
    if (ecoOk) {
      const churnCount = await ecoPool.query('SELECT COUNT(*) FROM ml_churn_risk');
      const affinityCount = await ecoPool.query('SELECT COUNT(*) FROM ml_product_affinity');
      console.log(`[ML] Intelligence Coverage (Churn):  ${churnCount.rows[0].count} clients`);
      console.log(`[ML] Intelligence Coverage (Affinity): ${affinityCount.rows[0].count} relations`);
    }

    // SAV Checks
    if (ecoOk) {
      const pendingCount = await ecoPool.query('SELECT COUNT(*) FROM acoes_pendentes WHERE status = \'PENDENTE\'');
      const approvedCount = await ecoPool.query('SELECT COUNT(*) FROM acoes_pendentes WHERE status = \'APROVADO\'');
      console.log(`[SAV] Queue Status:                 ${pendingCount.rows[0].count} Pending, ${approvedCount.rows[0].count} Approved (Waiting Sync)`);
    }

    // Performance Target
    const requiredIndexes = [
      'idx_pessoas_nmpessoa_trgm', 
      'idx_pessoas_nmcurto_trgm', 
      'idx_pessoas_cdchamada_trgm', 
      'idx_pessoas_nrcgc_cic_trgm',
      'idx_pessoas_phones_trgm',
      'idx_pessoas_telwa_trgm',
      'idx_pessoas_phone_trgm'
    ];
    if (mirrorOk) {
      const res = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'pessoas' AND indexname IN (${requiredIndexes.map((_,i) => '$'+(i+1)).join(',')})`, requiredIndexes);
      const found = res.rows.map(r => r.indexname);
      
      const phonesOk = found.includes('idx_pessoas_phones_trgm') || (found.includes('idx_pessoas_telwa_trgm') && found.includes('idx_pessoas_phone_trgm'));
      const othersOk = ['idx_pessoas_nmpessoa_trgm', 'idx_pessoas_nmcurto_trgm', 'idx_pessoas_cdchamada_trgm', 'idx_pessoas_nrcgc_cic_trgm'].every(idx => found.includes(idx));
      
      const optimized = phonesOk && othersOk;
      const foundCount = found.filter(idx => !['idx_pessoas_telwa_trgm', 'idx_pessoas_phone_trgm'].includes(idx)).length + (phonesOk ? 1 : 0);

      console.log(`[PERF] Trigram Search Optimization:  ${optimized ? '5/5' : foundCount + '/5'} indexes active`);
      if (!optimized) {
        console.log('       ⚠️  DBA ACTION REQUIRED: Search is not fully optimized.');
      } else {
        console.log('       ✅ Search is fully optimized.');
      }
    }

  } catch (e) {
    console.error('   Error fetching technical metrics:', e.message);
  }

  console.log('================================================================\n');
  process.exit(0);
}

main();
