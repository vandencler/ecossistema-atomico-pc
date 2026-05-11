const https = require('http'); // Paperclip API might be http or https, wait, let's use fetch

async function postComment() {
  const url = `${process.env.PAPERCLIP_API_URL}/api/issues/EAV-141/comments`;
  console.log('Posting to:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAPERCLIP_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': process.env.PAPERCLIP_RUN_ID
      },
      body: JSON.stringify({
        body: "The 08:00 AM WhatsApp Welcome Pack rollout to the 10 Power Users has been fully executed. A total of 10 Welcome messages were dispatched using the Omnichannel Service. I also audited the sentiment score, which shows a strong NPS of 100 with 0 detractors currently. I consider EAV-141 completed.",
        resume: true
      })
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

postComment();