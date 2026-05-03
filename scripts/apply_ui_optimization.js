const fs = require("fs");
const path = "src/main/services/uiService.js";
let code = fs.readFileSync(path, "utf8");

const oldQuery = `          SELECT
            COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO' AND COALESCE(status, 'PENDENTE') = 'PENDENTE') as sav_count,
            COUNT(*) FILTER (WHERE status = 'PENDENTE' AND (origem = 'MANUAL' AND criado_em < NOW() - ($1 || ' hours')::interval)) as sav_urgent
          FROM acoes_pendentes`;

const newQuery = `          SELECT
            COUNT(*) FILTER (WHERE tipo_acao = 'ALTERAR_CAMPO') as sav_count,
            COUNT(*) FILTER (WHERE origem = 'MANUAL' AND criado_em < NOW() - ($1 || ' hours')::interval) as sav_urgent
          FROM acoes_pendentes
          WHERE status = 'PENDENTE'`;

code = code.replace(oldQuery, newQuery);
fs.writeFileSync(path, code);
console.log("Optimized navigation alerts query in uiService.js");
