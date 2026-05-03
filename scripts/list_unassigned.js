
const cwd = process.cwd();
if (!cwd.toLowerCase().includes('-pc')) {
    console.error(`[FATAL] WORKSPACE MISMATCH: Running from ${cwd}`);
    console.error('This script MUST be executed from D:\projetos\ecossistema-atomico-pc');
    process.exit(1);
}

const headers = { Authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}` };
async function run() {
    const url = `${process.env.PAPERCLIP_API_URL}/api/companies/${process.env.PAPERCLIP_COMPANY_ID}/issues?limit=1000`;
    const res = await fetch(url, { headers });
    const list = await res.json();
    const data = list.value || list;
    const unassigned = data.filter(i => !i.assigneeAgentId && (i.status === 'todo' || i.status === 'backlog'));
    console.table(unassigned.map(i => ({ identifier: i.identifier, title: i.title, status: i.status })));
}
run();
