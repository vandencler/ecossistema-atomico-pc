
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error("This script MUST be executed from D:\projetos\ecossistema-atomico-pc");
    process.exit(1);
}

const fs = require("fs");
const path = "src/main/services/syncService.js";
let code = fs.readFileSync(path, "utf8");

// 1. Add helper to run fn in transaction using existing client
const helperInjection = `
async function runInClientTransaction(client, fn) {
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[SYNC] Falha ao reverter transacao SAV:', rollbackError.message);
    }
    throw error;
  }
}
`;

code = code.replace("async function withEcoTransaction(fn) {", helperInjection + "\nasync function withEcoTransaction(fn) {");

// 2. Refactor performSync to use persistent ecoClient
const performSyncOld = `async function performSync(items, options = {}) {
  let syncedCount = 0;
  const results = [];
  const actionIds = normalizeSyncItems(items);
  const dryRun = options.dryRun === true;
  const usuario = String(options.usuario || 'sync-service').trim().slice(0, 100) || 'sync-service';

  if (actionIds.length === 0) return { ok: true, syncedCount: 0, results: [] };

  let mirrorClient;

  try {
    mirrorClient = await pool.connect();

    for (const id of actionIds) {
      let action = { id };
      try {
        action = await loadApprovedAction(id);
        const target = resolveSyncTarget(action.campo);
        const previewSql = \`UPDATE \${target.tableName} SET \${action.campo} = CAST($1 AS text) WHERE idpessoa = CAST($2 AS text)\`;

        if (dryRun) {
          results.push({
            id: action.id,
            status: 'PREVIEW',
            sql: previewSql,
            params: ['<valor_novo>', '<idpessoa>'],
            targetTable: target.tableName
          });
          continue;
        }

        await withEcoTransaction((client) => markActionExecutionStarted(client, action.id, usuario));

        const updateResult = await mirrorClient.query(
          previewSql,
          [action.valor_novo, action.idpessoa]
        );
        if (updateResult.rowCount === 0) {
          throw new Error(\`Registro \${action.idpessoa} nao encontrado em \${target.tableName}\`);
        }

        await withEcoTransaction(async (client) => {
          await markActionExecutionDone(client, action.id, usuario);
          await client.query(\`
            UPDATE correcoes_campos
            SET sincronizado = true
            WHERE idpessoa = CAST($1 AS text) AND campo = CAST($2 AS text)
          \`, [action.idpessoa, action.campo]);
        });`;

const performSyncNew = `async function performSync(items, options = {}) {
  let syncedCount = 0;
  const results = [];
  const actionIds = normalizeSyncItems(items);
  const dryRun = options.dryRun === true;
  const usuario = String(options.usuario || 'sync-service').trim().slice(0, 100) || 'sync-service';

  if (actionIds.length === 0) return { ok: true, syncedCount: 0, results: [] };

  let mirrorClient;
  let ecoClient;

  try {
    mirrorClient = await pool.connect();
    if (!dryRun) {
      ecoClient = await ecoPool.connect();
    }

    for (const id of actionIds) {
      let action = { id };
      try {
        action = await loadApprovedAction(id);
        const target = resolveSyncTarget(action.campo);
        const previewSql = \`UPDATE \${target.tableName} SET \${action.campo} = CAST($1 AS text) WHERE idpessoa = CAST($2 AS text)\`;

        if (dryRun) {
          results.push({
            id: action.id,
            status: 'PREVIEW',
            sql: previewSql,
            params: ['<valor_novo>', '<idpessoa>'],
            targetTable: target.tableName
          });
          continue;
        }

        await runInClientTransaction(ecoClient, (client) => markActionExecutionStarted(client, action.id, usuario));

        const updateResult = await mirrorClient.query(
          previewSql,
          [action.valor_novo, action.idpessoa]
        );
        if (updateResult.rowCount === 0) {
          throw new Error(\`Registro \${action.idpessoa} nao encontrado em \${target.tableName}\`);
        }

        await runInClientTransaction(ecoClient, async (client) => {
          await markActionExecutionDone(client, action.id, usuario);
          await client.query(\`
            UPDATE correcoes_campos
            SET sincronizado = true
            WHERE idpessoa = CAST($1 AS text) AND campo = CAST($2 AS text)
          \`, [action.idpessoa, action.campo]);
        });`;

code = code.replace(performSyncOld, performSyncNew);

// 3. Update catch block to use ecoClient for error marking
const catchBlockOld = `        try {
          await withEcoTransaction((client) => markActionExecutionError(client, action.id, e, usuario));
        } catch (logErrorMsg) {`;

const catchBlockNew = `        try {
          if (ecoClient) {
            await runInClientTransaction(ecoClient, (client) => markActionExecutionError(client, action.id, e, usuario));
          } else {
            await withEcoTransaction((client) => markActionExecutionError(client, action.id, e, usuario));
          }
        } catch (logErrorMsg) {`;

code = code.replace(catchBlockOld, catchBlockNew);

// 4. Update finally block to release ecoClient
const finallyOld = `  } finally {
    if (mirrorClient) mirrorClient.release();
  }
}`;

const finallyNew = `  } finally {
    if (mirrorClient) mirrorClient.release();
    if (ecoClient) ecoClient.release();
  }
}`;

code = code.replace(finallyOld, finallyNew);

fs.writeFileSync(path, code);
console.log("Refactored performSync for connection resilience.");
