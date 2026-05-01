const fs = require('fs');
try {
  let data = fs.readFileSync('issues_active.json', 'utf8');
  // Remove BOM if present
  if (data.charCodeAt(0) === 0xFEFF) {
    data = data.slice(1);
  }
  const issues = JSON.parse(data);
  issues.forEach(i => console.log(`${i.identifier} [${i.status}] ${i.title} - Assignee: ${i.assigneeAgentId || i.assigneeUserId}`));
} catch (e) {
  console.error(e);
}
