const fs = require('fs');
const path = require('path');

const eav72Payload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eav-72-reassign.json'), 'utf8'));
const eav75Payload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eav-75-cancel.json'), 'utf8'));

function updateIssuesFile(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
     content = fs.readFileSync(filePath, 'utf16le');
  } else if (content.charCodeAt(0) === 65533) { // Fallback if utf16le is detected as strange chars
     content = fs.readFileSync(filePath, 'utf16le');
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
    if (issues[i].identifier === 'EAV-72') {
      issues[i].assigneeAgentId = eav72Payload.assigneeAgentId;
      issues[i].status = eav72Payload.status;
      // Also it's a good idea to add a comment or just update status
      updated = true;
    }
    if (issues[i].identifier === 'EAV-75') {
      issues[i].status = eav75Payload.status;
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(issues, null, 2), 'utf16le');
    console.log(`Updated ${fileName}`);
  } else {
    console.log(`No changes made to ${fileName}`);
  }
}

updateIssuesFile('issues_active.json');
updateIssuesFile('issues.json');
