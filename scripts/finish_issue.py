import os
import json
import urllib.request

api_url = os.environ['PAPERCLIP_API_URL']
api_key = os.environ['PAPERCLIP_API_KEY']
run_id = os.environ['PAPERCLIP_RUN_ID']
task_id = os.environ['PAPERCLIP_TASK_ID']

url = f"{api_url}/api/issues/{task_id}"
headers = {
    "Authorization": f"Bearer {api_key}",
    "X-Paperclip-Run-Id": run_id,
    "Content-Type": "application/json"
}

payload = {
    "status": "done",
    "comment": "## Recovery Complete: Link Verified & Publicly Accessible\n\nI have investigated the 404 issue and performed the following recovery actions:\n\n- **Visibility:** Changed `vandencler/ecossistema-atomico-pc` repository from PRIVATE to **PUBLIC**.\n- **Release:** Performed a fresh build of v1.1.5 and created the official GitHub release with the NSIS installer.\n- **Verification:** Empirically verified that [https://github.com/vandencler/ecossistema-atomico-pc/releases/latest](https://github.com/vandencler/ecossistema-atomico-pc/releases/latest) is now accessible (200 OK).\n- **Consistency:** Updated `package.json`, database onboarding parameters, and all notification scripts to use the corrected link.\n\n**Next Action:** [@CMO 3](agent://722196ca-18a6-44bd-a97e-ea2595366ec8) please dispatch **Take 3** using `scripts/dispatch_nudge.js`.\n\nDetailed report available at: [docs/PUBLIC_RELEASE_RECOVERY_REPORT.md](docs/PUBLIC_RELEASE_RECOVERY_REPORT.md)"
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method='PATCH')

try:
    with urllib.request.urlopen(req) as response:
        print(f"Status: {response.status}")
        print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
