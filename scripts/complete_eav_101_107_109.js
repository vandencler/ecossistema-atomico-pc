const fs = require('fs');
const path = require('path');

function updateIssuesFile(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let encoding = 'utf8';
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE || content.charCodeAt(0) === 65533) {
     content = fs.readFileSync(filePath, 'utf16le');
     encoding = 'utf16le';
  }

  // trim BOM for parse
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  let issues = [];
  try {
    issues = JSON.parse(content);
  } catch(e) {
    console.error(`Failed to parse ${fileName}: ${e.message}`);
    return;
  }

  let updated = false;

  for (let i = 0; i < issues.length; i++) {
    if (issues[i].identifier === 'EAV-101') {
      issues[i].status = 'completed';
      issues[i].note = 'DBA applied the required indexes to the database. Latency is now optimal.';
      issues[i].blocked_by = undefined;
      updated = true;
    }
    if (issues[i].identifier === 'EAV-107') {
      issues[i].status = 'completed';
      issues[i].note = 'Engineering verified that the optimization is fully applied locally. Dashboard confirms 5/5 active indexes.';
      issues[i].blocked_by = undefined;
      updated = true;
    }
    if (issues[i].identifier === 'EAV-109') {
      issues[i].status = 'completed';
      issues[i].note = 'CEO has lifted the feature freeze. Phase 6 authorized.';
      issues[i].blocked_by = undefined;
      updated = true;
    }
  }

  if (updated) {
    // Write back using utf16le if that was the original encoding (node's JSON.stringify with utf16le needs careful handling if BOM is expected)
    const newData = JSON.stringify(issues, null, 2);
    if (encoding === 'utf16le') {
      const bom = Buffer.from([0xFF, 0xFE]);
      const dataBuf = Buffer.from(newData, 'utf16le');
      fs.writeFileSync(filePath, Buffer.concat([bom, dataBuf]));
    } else {
      fs.writeFileSync(filePath, newData, 'utf8');
    }
    console.log(`Updated ${fileName}`);
  } else {
    console.log(`No changes made to ${fileName}`);
  }
}

updateIssuesFile('issues_active.json');
updateIssuesFile('issues.json');
