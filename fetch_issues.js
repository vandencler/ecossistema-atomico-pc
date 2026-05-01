fetch(process.env.PAPERCLIP_API_URL + '/api/companies/' + process.env.PAPERCLIP_COMPANY_ID + '/issues?status=todo,in_progress,blocked,in_review', {
  headers: {
    'Authorization': 'Bearer ' + process.env.PAPERCLIP_API_KEY,
    'X-Paperclip-Run-Id': process.env.PAPERCLIP_RUN_ID
  }
}).then(res => res.text()).then(text => console.log(text)).catch(console.error);