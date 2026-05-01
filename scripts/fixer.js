const fs = require("fs");
const path = "D:/projetos/ecossistema-atomico-pc/src/main/services/clientService.js";
let c = fs.readFileSync(path, "utf8");
// Correcting the corrupted line: `(params.length)::text` -> `($${params.length})::text`
// In the file it should look like: return `($${params.length})::text`;
c = c.replace(/return `\(params\.length\)::text`;/, "return `($${params.length})::text`;");
fs.writeFileSync(path, c);
