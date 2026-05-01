async function main() {
  const token = process.env.PAPERCLIP_API_KEY;
  const baseUrl = process.env.PAPERCLIP_API_URL;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;

  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const res = await fetch(`${baseUrl}/api/companies/${companyId}/agents`, { headers });
  if (!res.ok) {
    console.error('Failed to fetch agents', res.status);
    return;
  }
  const data = await res.json();
  const agents = Array.isArray(data) ? data : (data.value || []);
  
  console.log('--- Agents ---');
  agents.forEach(a => {
    console.log(`[${a.id}] ${a.name} - Role: ${a.role}`);
  });
}
main();