import crypto from "crypto";

const CHANNEL_SECRET = process.env.CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN || "";

function validateSignature(body, signature) {
  try {
    if (!signature) return false;
    const h = crypto.createHmac("sha256", CHANNEL_SECRET);
    h.update(body);
    return h.digest("base64") === signature;
  } catch {
    return false;
  }
}

async function reply(replyToken, messages) {
  if (!CHANNEL_ACCESS_TOKEN) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
  } catch (e) {
    console.error("reply error:", e);
  }
}

function isTestToken(t = "") {
  return /^0{8,}/i.test(t) || /^f{8,}/i.test(t) || t.toLowerCase().includes("test");
}

async function processEvents(events = []) {
  for (const ev of events) {
    try {
      if (ev.type !== "message" || ev.message?.type !== "text") continue;

      const replyToken = ev.replyToken || "";
      if (isTestToken(replyToken)) continue;

      const text = (ev.message?.text || "").trim();
      const userId = ev.source?.userId || "-";

      if (/^status$/i.test(text)) {
        await reply(replyToken, [{
          type: "text",
          text: `✅ Bot online\nuserId: ${userId}\nLAT:${process.env.LAT ?? "-"} LON:${process.env.LON ?? "-"}`
        }]);
        continue;
      }

      await reply(replyToken, [{
        type: "text",
        text: `指令：\nstatus － 檢查連線並顯示你的 userId`
      }]);
    } catch (err) {
      console.error("event error:", err);
    }
  }
}

export default async function handler(req) {
  try {
    // 1) 非 POST 直接 200（Verify 會用 GET）
    if (req.method !== "POST") return new Response("OK", { status: 200 });

    // 2) 取原始 body 與簽章
    const bodyText = await req.text();
    const signature = req.headers.get("x-line-signature");

    // 3) 驗簽失敗 → 也回 200（避免 Verify/探測報錯）
    if (!validateSignature(bodyText, signature)) {
      return new Response("OK", { status: 200 });
    }

    // 4) 解析 payload
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("OK", { status: 200 });
    }

    // 5) 背景處理，不等待（避免逾時）
    queueMicrotask(() => processEvents(payload.events || []).catch(console.error));
    // 立即回應 200
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("handler error:", e);
    // 就算拋錯也回 200，避免 LINE 判逾時/失敗
    return new Response("OK", { status: 200 });
  }
}

