import crypto from 'crypto';

const CHANNEL_SECRET = process.env.CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

async function reply(replyToken, messages) {
  if (!CHANNEL_ACCESS_TOKEN) return;
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
  if (!signature) return false;                 // Verify 可能不帶簽章
  const hmac = crypto.createHmac('sha256', CHANNEL_SECRET || '');
  hmac.update(body);
  const expected = hmac.digest('base64');
  return expected === signature;
}

export default async function handler(req) {
  // LINE 的 Verify 可能送 GET，直接回 200
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  const bodyText = await req.text();
  const signature = req.headers.get('x-line-signature');

  // 簽章不對：回 200（讓 Verify 過），但不處理事件
  if (!validateSignature(bodyText, signature)) {
    return new Response('OK', { status: 200 });
  }

  const { events = [] } = JSON.parse(bodyText);

  await Promise.all(events.map(async ev => {
    if (ev.type !== 'message' || ev.message.type !== 'text') return;

    const replyToken = ev.replyToken || '';
    // Verify/測試事件可能給假的 replyToken：偵測到就不回覆，避免 401
    const isTest = /^0{8,}/i.test(replyToken) || /^f{8,}/i.test(replyToken);
    if (isTest) return;

    const text = (ev.message.text || '').trim();
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
