const fs = require("fs");
const path = require("path");

const scriptsDir = path.join(process.cwd(), "scripts");
const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith(".js"));

const verifyCode = `
const cwd = process.cwd();
if (!cwd.toLowerCase().includes("-pc")) {
    console.error(\`[FATAL] WORKSPACE MISMATCH: Running from \${cwd}\`);
    console.error("This script MUST be executed from D:\\projetos\\ecossistema-atomico-pc");
    process.exit(1);
}
`;

files.forEach(file => {
    const fullPath = path.join(scriptsDir, file);
    let content = fs.readFileSync(fullPath, "utf8");
    if (!content.includes("WORKSPACE MISMATCH")) {
        // Find first appropriate insertion point (after 'use strict' or imports)
        // For simplicity, just prepend it.
        content = verifyCode + "\n" + content;
        fs.writeFileSync(fullPath, content);
        console.log(`Hardened ${file}`);
    }
});
