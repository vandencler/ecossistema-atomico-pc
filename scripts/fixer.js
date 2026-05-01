const fs = require("fs");
const path = "D:/projetos/ecossistema-atomico-pc/src/main/services/clientService.js";
let c = fs.readFileSync(path, "utf8");
// Use a more reliable way to find the line
const oldStr = "return `$${params.length}::text`;";
const newStr = "return `($${params.length})::text`;";
if (c.indexOf(oldStr) === -1) {
    console.log("NOT FOUND, maybe already changed or slightly different?");
    // Try without the outer dollar sign if I messed up earlier
    c = c.replace("return `(${params.length})::text`;", "return `($${params.length})::text`;");
} else {
    c = c.replace(oldStr, newStr);
}
fs.writeFileSync(path, c);
