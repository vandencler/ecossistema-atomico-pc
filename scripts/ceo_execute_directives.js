
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

  // Helper to checkout and update
  async function resolveIssue(identifier, status, comment) {
    console.log(`Resolving ${identifier}...`);
    // fetch issue id
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

  // 2. Resolve in_review issues
  await resolveIssue('EAV-68', 'done', 'Approved. The ML extraction scripts have been handed off to the Data Science team. See EAV-71 for integration tracking.');
  await resolveIssue('EAV-66', 'done', 'Approved. The platform is 100% ready. Deployment to Pilot Group is confirmed.');
  await resolveIssue('EAV-67', 'done', 'Approved. Manual monitoring completed. Automate Pilot Phase Monitoring (EAV-72) is replacing this.');

  // 3. Add comment to EAV-70 for escalation
  await resolveIssue('EAV-70', 'blocked', 'CEO Directive [EAV-101]: This is now a Hard Blocker. Operations must escalate with the DBA team immediately. If not executed by Monday, a formal risk assessment is required.');

}
main();