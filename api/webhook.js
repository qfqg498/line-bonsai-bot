import crypto from 'crypto';

const CHANNEL_SECRET = process.env.CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

async function reply(replyToken, messages) {
  if (!CHANNEL_ACCESS_TOKEN) return; // 沒 token 就不送，避免 401
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
  // Verify 可能用 GET；直接回 200
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  const bodyText = await req.text();
  const signature = req.headers.get('x-line-signature');

  // 有些 Verify 會 POST 但不帶簽章；一律回 200
  if (!validateSignature(bodyText, signature)) {
    return new Response('OK', { status: 200 });
  }

  const { events = [] } = JSON.parse(bodyText);

  await Promise.all(events.map(async ev => {
    if (ev.type !== 'message' || ev.message.type !== 'text') return;
    const replyToken = ev.replyToken || '';

    // LINE 測試用的假 token（全 0 或全 f）→ 不要回覆，直接略過
    const isTestToken =
      /^0{10,}/i.test(replyToken) || /^f{10,}/i.test(replyToken);
    if (isTestToken) return;

    const text = ev.message.text.trim();
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
