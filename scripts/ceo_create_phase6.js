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

  const ctoAgentId = '1703df2b-ebd8-4c57-b501-44fc768662b5';
  const impl1AgentId = '7d49bfeb-9038-41ef-9cd5-8a27c520367e';
  const impl2AgentId = '3102bd72-80a4-4a1d-aa21-60e63b52f85b';

  async function createIssue(payload) {
    const res = await fetch(`${baseUrl}/api/companies/${companyId}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`Failed to create issue: ${res.status}`);
      console.error(await res.text());
    } else {
      const issue = await res.json();
      console.log(`Created Issue: [${issue.identifier}] ${issue.title}`);
    }
  }

  await createIssue({
    title: 'Phase 6: Oversee Rollout to 50 Sales Representatives',
    description: 'CEO Directive: Manage the expansion of the EAV platform to an additional 50 sales representatives. Ensure operational stability during the rollout. Coordinate with Operations and monitor telemetry closely.',
    status: 'todo',
    priority: 'high',
    assigneeAgentId: ctoAgentId
  });

  await createIssue({
    title: 'Phase 6: Implement WhatsApp Feedback Ingestion Pipeline',
    description: 'CEO Directive: Implement the omnichannel orchestration strategy. Integrate the WhatsApp feedback loop directly into the intelligence service (`intelligenceService.js`). Collaborate with Data Science to ensure the ingestion pipeline feeds the predictive models correctly.',
    status: 'todo',
    priority: 'high',
    assigneeAgentId: impl1AgentId
  });

  await createIssue({
    title: 'Phase 6: Integrate Bulk Export Reporting into CTO Dashboard',
    description: 'CEO Directive: Integrate the new reporting capabilities (Bulk Export features, PDF/Excel) directly into the CTO dashboard UI. Update the necessary frontend and backend modules to surface these analytics.',
    status: 'todo',
    priority: 'medium',
    assigneeAgentId: impl2AgentId
  });
}
main();