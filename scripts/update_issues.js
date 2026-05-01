const fs = require('fs');
const path = require('path');

function updateIssuesFile(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf16le');
  
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

  const eav85 = issues.find(i => i.identifier === 'EAV-85');
  if (!eav85) {
    issues.push({
      identifier: 'EAV-85',
      title: 'WhatsApp Feedback Ingestion',
      status: 'completed',
      description: 'Implement WhatsApp webhook ingestion and engagement scoring.'
    });
    updated = true;
  } else if (eav85.status !== 'completed') {
    eav85.status = 'completed';
    updated = true;
  }

  const eav86 = issues.find(i => i.identifier === 'EAV-86');
  if (eav86 && eav86.status !== 'completed') {
    eav86.status = 'completed';
    updated = true;
  }

  if (updated) {
    const buffer = Buffer.from('\uFEFF' + JSON.stringify(issues, null, 2), 'utf16le');
    fs.writeFileSync(filePath, buffer);
    console.log(`Updated ${fileName}`);
  } else {
    console.log(`No changes made to ${fileName}`);
  }
}

updateIssuesFile('issues_active.json');

