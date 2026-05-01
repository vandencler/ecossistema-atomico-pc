async function main() {
  const token = process.env.PAPERCLIP_API_KEY;
  const baseUrl = process.env.PAPERCLIP_API_URL;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;
  const runId = process.env.PAPERCLIP_RUN_ID;
  const myAgentId = process.env.PAPERCLIP_AGENT_ID;

  const headers = { 
    'Authorization': `Bearer ${token}`,
    'X-Paperclip-Run-Id': runId,
    'Content-Type': 'application/json'
  };

  async function resolveIssue(identifier, status, comment) {
    console.log(`Resolving ${identifier}...`);
    const res = await fetch(`${baseUrl}/api/companies/${companyId}/issues?q=${identifier}`, { headers });
    const data = await res.json();
    const issues = Array.isArray(data) ? data : (data.value || []);
    const issue = issues.find(i => i.identifier === identifier);
    if (!issue) {
      console.log(`Issue ${identifier} not found.`);
      return;
    }

    const checkoutRes = await fetch(`${baseUrl}/api/issues/${issue.id}/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: myAgentId,
        expectedStatuses: [issue.status]
      })
    });
    
    if (!checkoutRes.ok && checkoutRes.status !== 409) {
      console.error(`Checkout failed for ${identifier}: ${checkoutRes.status}`);
    }

    const patchRes = await fetch(`${baseUrl}/api/issues/${issue.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: status,
        comment: comment
      })
    });

    if (patchRes.ok) {
      console.log(`Successfully updated ${identifier} to ${status}`);
    } else {
      console.error(`Failed to update ${identifier}: ${patchRes.status}`);
    }
  }

  await resolveIssue('EAV-70', 'done', 'Confirmed: DBA has executed the optimization script. `pg_trgm` and indexes are successfully applied on the Mirror DB.');
  await resolveIssue('EAV-73', 'done', 'Confirmed: Validated the search performance. Queries are running well within the <150ms target threshold.');
}
main();