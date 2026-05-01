const fs = require('fs');
const path = require('path');

function updateIssuesFile(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) return;
  
  const buf = fs.readFileSync(filePath);
  let isUtf16 = false;
  
  // Check for UTF-16LE (even without BOM, second byte is 0 for ASCII text)
  if (buf.length >= 2 && buf[1] === 0 && buf[0] !== 0) {
    isUtf16 = true;
  }
  
  // Check for BOMs
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    isUtf16 = true;
  }

  let content = isUtf16 ? buf.toString('utf16le') : buf.toString('utf8');

  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 65533) {
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
    if (issues[i].identifier === 'EAV-101' || issues[i].identifier === 'EAV-107') {
      issues[i].status = 'completed';
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(issues, null, 2), isUtf16 ? 'utf16le' : 'utf8');
    console.log(`Updated ${fileName}`);
  } else {
    console.log(`No changes made to ${fileName}`);
  }
}

updateIssuesFile('issues_active.json');
updateIssuesFile('issues.json');
