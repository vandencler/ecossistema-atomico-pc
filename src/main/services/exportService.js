const { pool } = require('../db');
const { logError, logEvent } = require('./logService');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PdfPrinter = require('pdfmake');
const { isOfflineMode } = require('./healthService');
const { getLocalDb } = require('../localDb');

const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

async function exportClientData(idpessoa, format, destPath) {
  try {
    let profile;
    let purchases;

    if (await isOfflineMode()) {
      const db = getLocalDb();
      profile = db.prepare('SELECT idpessoa, nmpessoa, nmcurto, nrcgc_cic, nrtelefone, campostelwhatsapp, nrpager, dtultimacompra FROM client_cache WHERE idpessoa = ?').get(idpessoa);
      
      if (!profile) throw new Error('Dados do cliente não encontrados no cache offline.');
      
      purchases = db.prepare('SELECT dtemissao, nrnotafiscal, vltotal, dsobservacao FROM last_purchases_cache WHERE idpessoa = ? ORDER BY dtemissao DESC').all(idpessoa);
    } else {
      const profileRes = await pool.query(`
        SELECT p.idpessoa, p.nmpessoa, p.nmcurto, p.nrcgc_cic, p.email, p.nrtelefone, p.campostelwhatsapp, p.nrpager, p.dtultimacompra
        FROM wshop.pessoas p
        WHERE p.idpessoa = $1
      `, [idpessoa]);

      profile = profileRes.rows[0];
      if (!profile) throw new Error('Cliente nao encontrado');

      const purchasesRes = await pool.query(`
        SELECT n.dtemissao, n.nrnotafiscal, d.vltotal, d.dsobservacao
        FROM wshop.documen d
        LEFT JOIN wshop.documento_nfce n ON n.iddocumento = d.iddocumento
        WHERE d.idpessoa = $1 AND d.tpoperacao = 'V'
          AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
        ORDER BY n.dtemissao DESC NULLS LAST
      `, [idpessoa]);
      purchases = purchasesRes.rows;
    }

    if (format === 'pdf') {
      return await generateClientPDF(profile, purchases, destPath);
    } else if (format === 'excel') {
      return await generateClientExcel(profile, purchases, destPath);
    } else {
      throw new Error('Formato de exportacao nao suportado');
    }
  } catch (e) {
    await logError('EXPORT_CLIENT', e, idpessoa);
    return { error: e.message };
  }
}

async function bulkExportClients(ids, format, destPath) {
  try {
    if (format !== 'pdf' && format !== 'excel') {
      throw new Error('Formato de exportacao nao suportado');
    }

    const clientsData = [];
    for (const idpessoa of ids) {
      let profile;
      let purchases;

      if (await isOfflineMode()) {
        const db = getLocalDb();
        profile = db.prepare('SELECT idpessoa, nmpessoa, nmcurto, nrcgc_cic, nrtelefone, campostelwhatsapp, nrpager, dtultimacompra FROM client_cache WHERE idpessoa = ?').get(idpessoa);
        if (!profile) continue;
        purchases = db.prepare('SELECT dtemissao, nrnotafiscal, vltotal, dsobservacao FROM last_purchases_cache WHERE idpessoa = ? ORDER BY dtemissao DESC').all(idpessoa);
      } else {
        const profileRes = await pool.query(`
          SELECT p.idpessoa, p.nmpessoa, p.nmcurto, p.nrcgc_cic, p.email, p.nrtelefone, p.campostelwhatsapp, p.nrpager, p.dtultimacompra
          FROM wshop.pessoas p
          WHERE p.idpessoa = $1
        `, [idpessoa]);

        profile = profileRes.rows[0];
        if (!profile) continue;

        const purchasesRes = await pool.query(`
          SELECT n.dtemissao, n.nrnotafiscal, d.vltotal, d.dsobservacao
          FROM wshop.documen d
          LEFT JOIN wshop.documento_nfce n ON n.iddocumento = d.iddocumento
          WHERE d.idpessoa = $1 AND d.tpoperacao = 'V'
            AND (d.stdocumentocancelado IS NULL OR d.stdocumentocancelado != 'S')
          ORDER BY n.dtemissao DESC NULLS LAST
        `, [idpessoa]);
        purchases = purchasesRes.rows;
      }
      clientsData.push({ profile, purchases });
    }

    if (clientsData.length === 0) {
      throw new Error('Nenhum dado de cliente encontrado para exportacao.');
    }

    if (format === 'pdf') {
      return await generateBulkClientPDF(clientsData, destPath);
    } else if (format === 'excel') {
      return await generateBulkClientExcel(clientsData, destPath);
    }
  } catch (e) {
    await logError('BULK_EXPORT', e);
    return { error: e.message };
  }
}

async function generateClientPDF(profile, purchases, destPath) {
  return new Promise((resolve, reject) => {
    try {
      const tel = profile.nrtelefone || profile.campostelwhatsapp || profile.nrpager || '-';
      const docDefinition = {
        content: [
          { text: `Relatorio de Cliente: ${profile.nmpessoa}`, style: 'header' },
          { text: `Doc: ${profile.nrcgc_cic || '-'} | Email: ${profile.email || '-'} | Tel: ${tel}`, margin: [0, 5, 0, 15] },
          { text: 'Historico de Compras', style: 'subheader' },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', '*', 'auto'],
              body: [
                ['Data', 'NF', 'Observacao', 'Valor (R$)'],
                ...purchases.map(p => [
                  p.dtemissao ? new Date(p.dtemissao).toLocaleDateString('pt-BR') : '-',
                  p.nrnotafiscal || '-',
                  p.dsobservacao || '-',
                  parseFloat(p.vltotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                ])
              ]
            }
          }
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
          subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
        }
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      pdfDoc.pipe(fs.createWriteStream(destPath));
      pdfDoc.on('end', async () => {
        await logEvent('EXPORT_PDF', profile.idpessoa, `PDF salvo em: ${destPath}`);
        resolve({ ok: true, path: destPath });
      });
      pdfDoc.on('error', (err) => reject(err));
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generateBulkClientPDF(clientsData, destPath) {
  return new Promise((resolve, reject) => {
    try {
      const content = [];
      clientsData.forEach(({ profile, purchases }, index) => {
        if (index > 0) {
          content.push({ text: '', pageBreak: 'before' });
        }
        const tel = profile.nrtelefone || profile.campostelwhatsapp || profile.nrpager || '-';
        content.push({ text: `Relatorio de Cliente: ${profile.nmpessoa}`, style: 'header' });
        content.push({ text: `Doc: ${profile.nrcgc_cic || '-'} | Email: ${profile.email || '-'} | Tel: ${tel}`, margin: [0, 5, 0, 15] });
        content.push({ text: 'Historico de Compras', style: 'subheader' });
        content.push({
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto'],
            body: [
              ['Data', 'NF', 'Observacao', 'Valor (R$)'],
              ...purchases.map(p => [
                p.dtemissao ? new Date(p.dtemissao).toLocaleDateString('pt-BR') : '-',
                p.nrnotafiscal || '-',
                p.dsobservacao || '-',
                parseFloat(p.vltotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              ])
            ]
          }
        });
      });

      const docDefinition = {
        content,
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
          subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
        }
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      pdfDoc.pipe(fs.createWriteStream(destPath));
      pdfDoc.on('end', async () => {
        await logEvent('BULK_EXPORT_PDF', '0', `PDF em lote salvo em: ${destPath}`);
        resolve({ ok: true, path: destPath });
      });
      pdfDoc.on('error', (err) => reject(err));
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generateClientExcel(profile, purchases, destPath) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Historico de Compras');

    sheet.addRow(['Cliente:', profile.nmpessoa]);
    sheet.addRow(['Doc:', profile.nrcgc_cic || '-']);
    sheet.addRow([]);
    
    sheet.addRow(['Data', 'Nota Fiscal', 'Valor', 'Observacao']);
    sheet.getRow(4).font = { bold: true };

    purchases.forEach(p => {
      sheet.addRow([
        p.dtemissao ? new Date(p.dtemissao).toLocaleDateString('pt-BR') : '-',
        p.nrnotafiscal || '-',
        parseFloat(p.vltotal || 0),
        p.dsobservacao || '-'
      ]);
    });

    await workbook.xlsx.writeFile(destPath);
    await logEvent('EXPORT_EXCEL', profile.idpessoa, `Excel salvo em: ${destPath}`);
    return { ok: true, path: destPath };
  } catch (e) {
    throw e;
  }
}

async function generateBulkClientExcel(clientsData, destPath) {
  try {
    const workbook = new ExcelJS.Workbook();

    clientsData.forEach(({ profile, purchases }) => {
      let sheetName = (profile.nmpessoa || `Cliente_${profile.idpessoa}`).substring(0, 31);
      sheetName = sheetName.replace(/[*?:\/\\[\\]\\\\]/g, '');
      
      let finalSheetName = sheetName;
      let counter = 1;
      while (workbook.getWorksheet(finalSheetName)) {
        finalSheetName = `${sheetName.substring(0, 27)}_${counter}`;
        counter++;
      }

      const sheet = workbook.addWorksheet(finalSheetName);

      sheet.addRow(['Cliente:', profile.nmpessoa]);
      sheet.addRow(['Doc:', profile.nrcgc_cic || '-']);
      sheet.addRow([]);
      
      sheet.addRow(['Data', 'Nota Fiscal', 'Valor', 'Observacao']);
      sheet.getRow(4).font = { bold: true };

      purchases.forEach(p => {
        sheet.addRow([
          p.dtemissao ? new Date(p.dtemissao).toLocaleDateString('pt-BR') : '-',
          p.nrnotafiscal || '-',
          parseFloat(p.vltotal || 0),
          p.dsobservacao || '-'
        ]);
      });
    });

    await workbook.xlsx.writeFile(destPath);
    await logEvent('BULK_EXPORT_EXCEL', '0', `Excel em lote salvo em: ${destPath}`);
    return { ok: true, path: destPath };
  } catch (e) {
    throw e;
  }
}

async function bulkExportByPriority(priorityBucket, format, destPath) {
  try {
    const savService = require('./savService');
    const queueData = await savService.getActionQueue({
      prioridade: priorityBucket,
      status: 'TODOS',
      limit: 500
    });
    
    if (queueData.error) {
      throw new Error(queueData.error);
    }
    
    const ids = Array.from(new Set(queueData.rows.map(row => row.idpessoa).filter(Boolean)));
    
    if (ids.length === 0) {
      throw new Error(`Nenhum cliente encontrado na prioridade '${priorityBucket}' para exportacao.`);
    }
    
    return await bulkExportClients(ids, format, destPath);
  } catch (e) {
    await logError('BULK_EXPORT_PRIORITY', e);
    return { error: e.message };
  }
}

module.exports = {
  exportClientData,
  bulkExportClients,
  bulkExportByPriority
};