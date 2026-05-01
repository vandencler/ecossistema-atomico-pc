const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire').noCallThru();

test('exportClientData - should handle client not found', async () => {
  const mockPool = {
    query: async () => ({ rows: [] })
  };
  const { exportClientData } = proxyquire('../src/main/services/exportService', {
    '../db': { pool: mockPool },
    './logService': { logError: async () => {}, logEvent: async () => {} },
    'exceljs': {},
    'pdfmake': class PdfPrinter {
      createPdfKitDocument() { return { pipe: () => {}, on: () => {}, end: () => {} }; }
    },
    './healthService': { isOfflineMode: async () => false },
    '../localDb': { getLocalDb: () => { throw new Error('Should not be called'); } }
  });

  const result = await exportClientData('0', 'pdf', 'dummy.pdf');
  assert.ok(result.error);
  assert.strictEqual(result.error, 'Cliente nao encontrado');
});

test('exportClientData - should generate Excel successfully', async () => {
  let workbookCreated = false;
  let fileSaved = false;

  class MockWorkbook {
    addWorksheet() {
      return {
        addRow: () => {},
        getRow: () => ({ font: {} })
      };
    }
    get xlsx() {
      return {
        writeFile: async (path) => {
          fileSaved = path === 'test.xlsx';
          return true;
        }
      };
    }
  }

  const mockPool = {
    query: async (sql) => {
      if (sql.includes('pessoas')) return { rows: [{ idpessoa: '1', nmpessoa: 'Test' }] };
      return { rows: [] };
    }
  };

  const { exportClientData } = proxyquire('../src/main/services/exportService', {
    '../db': { pool: mockPool },
    './logService': { logError: async () => {}, logEvent: async () => {} },
    'exceljs': {
      Workbook: class extends MockWorkbook {
        constructor() {
          super();
          workbookCreated = true;
        }
      }
    },
    'pdfmake': class PdfPrinter {},
    './healthService': { isOfflineMode: async () => false },
    '../localDb': { getLocalDb: () => { throw new Error('Should not be called'); } }
  });

  const result = await exportClientData('1', 'excel', 'test.xlsx');
  assert.ok(result.ok);
  assert.ok(workbookCreated);
  assert.ok(fileSaved);
});

test('exportClientData - should use local cache in offline mode', async () => {
  const mockDb = {
    prepare: (sql) => {
      if (sql.includes('client_cache')) {
        return { get: () => ({ idpessoa: '2', nmpessoa: 'Offline Client' }) };
      }
      if (sql.includes('last_purchases_cache')) {
        return { all: () => [{ dtemissao: '2026-05-01', vltotal: 100 }] };
      }
      return { get: () => null, all: () => [] };
    }
  };

  let fileSaved = false;

  const { exportClientData } = proxyquire('../src/main/services/exportService', {
    '../db': { pool: { query: async () => { throw new Error('Should not call postgres'); } } },
    './logService': { logError: async () => {}, logEvent: async () => {} },
    'exceljs': {
      Workbook: class {
        addWorksheet() { return { addRow: () => {}, getRow: () => ({ font: {} }) }; }
        get xlsx() { return { writeFile: async () => { fileSaved = true; return true; } }; }
      }
    },
    'pdfmake': class PdfPrinter {},
    './healthService': { isOfflineMode: async () => true },
    '../localDb': { getLocalDb: () => mockDb }
  });

  const result = await exportClientData('2', 'excel', 'offline.xlsx');
  assert.ok(result.ok);
  assert.ok(fileSaved);
});
