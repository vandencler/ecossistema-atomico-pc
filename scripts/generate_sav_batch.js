const fs = require('fs');
const path = require('path');
const { generateBatchScript, markBatchAsExported } = require('../src/main/services/syncService');

async function run() {
  console.log('=== Gerador de Lote SAV (Operational Gate) ===');
  
  try {
    const result = await generateBatchScript();
    
    if (!result.ok) {
      throw new Error(result.error);
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `EAV_BATCH_${dateStr}_v1.sql`;
    const outputPath = path.join(__dirname, '..', 'docs', filename);

    if (!result.ids || result.ids.length === 0) {
      console.log('Nenhum item pendente de exportação.');
      fs.writeFileSync(outputPath, result.sql || '-- Nenhum item sincronizado pendente de exportacao ERP.', 'utf8');
      console.log(`✅ Script atualizado vazio: ${outputPath}`);
      process.exit(0);
    }

    fs.writeFileSync(outputPath, result.sql, 'utf8');
    console.log(`✅ Script gerado com sucesso: ${outputPath}`);
    console.log(`📄 Total de itens: ${result.ids.length}`);

    // Per protocol, we should mark them as exported so they aren't included in the next one
    const loteId = await markBatchAsExported(result.ids);
    console.log(`📦 Lote ID ${loteId} atribuído aos itens.`);

  } catch (e) {
    console.error('❌ Falha ao gerar lote:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
