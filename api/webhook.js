import crypto from 'crypto';

const CHANNEL_SECRET = process.env.CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

async function reply(replyToken, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
}

function validateSignature(body, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', CHANNEL_SECRET);
  hmac.update(body);
  const expected = hmac.digest('base64');
  return expected === signature;
}

export default async function handler(req) {
  // ① LINE 的 Verify 可能用 GET；直接回 200 通過驗證
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  const bodyText = await req.text();
  const signature = req.headers.get('x-line-signature');

  // ② 有些 Verify 會 POST 但不帶簽章；也讓它過（不處理事件）
  if (!validateSignature(bodyText, signature)) {
    return new Response('OK', { status: 200 });
  }

  // ③ 簽章正確才處理事件
  const { events = [] } = JSON.parse(bodyText);

  await Promise.all(events.map(async ev => {
    if (ev.type !== 'message' || ev.message.type !== 'text') return;
    const text = ev.message.text.trim();
    const replyToken = ev.replyToken;
    const userId = ev.source?.userId;

    if (/^status$/i.test(text)) {
      return reply(replyToken, [{
        type: 'text',
        text: `✅ Bot online\nuserId: ${userId}\nLAT:${process.env.LAT ?? '-'} LON:${process.env.LON ?? '-'}`
      }]);
    }

    return reply(replyToken, [{
      type: 'text',
      text: `指令：\nstatus － 檢查連線並顯示你的 userId`
    }]);
  }));

  return new Response('OK', { status: 200 });
}
