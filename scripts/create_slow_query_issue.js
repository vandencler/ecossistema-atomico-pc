async function main() {
  const token = process.env.PAPERCLIP_API_KEY;
  const baseUrl = process.env.PAPERCLIP_API_URL;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;

  const res = await fetch(`${baseUrl}/api/companies/${companyId}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Investigate Lingering Slow Queries after EAV-101 Optimization',
      description: 'The DBA optimization (EAV-101) for Trigram Search has been applied and verified as TOTALMENTE OTIMIZADO. However, our telemetry still indicates 16 slow queries in the last 15 minutes. An engineer needs to investigate `lookupService.js` or the search queries to ensure they are properly utilizing the trigram indexes and not falling back to sequential scans or failing to hit the `cdchamada` / `phones` indexes properly.',
      priority: 'high',
      status: 'todo'
    })
  });
  
  if (res.ok) {
    const issue = await res.json();
    console.log(`Created Issue: [${issue.identifier}]`);
  } else {
    console.error('Failed to create issue', await res.text());
  }
}
main();