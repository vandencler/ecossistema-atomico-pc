const fs = require("fs");
const path = "tests/nps.test.js";
let code = fs.readFileSync(path, "utf8");

// 1. Fix event name
code = code.replace("'login'", "'APP_LOAD'");

// 2. Add nrpager to mock row to be safe and match new schema
code = code.replace("campostelwhatsapp: null }", "campostelwhatsapp: null, nrpager: null }");

fs.writeFileSync(path, code);
console.log("Fixed tests/nps.test.js");
