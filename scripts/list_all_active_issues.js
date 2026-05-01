async function main() {
  const token = process.env.PAPERCLIP_API_KEY;
  const baseUrl = process.env.PAPERCLIP_API_URL;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;

  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const res = await fetch(`${baseUrl}/api/companies/${companyId}/issues?status=todo,in_progress,in_review,blocked`, { headers });
  const data = await res.json();
  const issues = Array.isArray(data) ? data : (data.value || []);
  
  console.log('--- Active Issues ---');
  issues.forEach(i => {
    console.log(`[${i.identifier}] ${i.title} - Status: ${i.status} - ID: ${i.id}`);
    console.log(`Description: ${i.description}\n`);
  });
}
main();