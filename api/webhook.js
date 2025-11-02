import crypto from "crypto";

const CHANNEL_SECRET = process.env.CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN || "";

// --- helpers ---
function validateSignature(body, signature) {
  try {
    if (!signature) return false; // 有些 Verify 不帶簽章
    const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
    hmac.update(body);
    const expected = hmac.digest("base64");
    return expected === signature;
  } catch {
    return false;
  }
}

async function safeReply(replyToken, messages) {
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
    // 吞掉錯誤，避免 500
    console.error("reply error:", e);
  }
}

function isTestReplyToken(token = "") {
  // 部分 Verify / 測試事件給的 token 不可用；偵測就略過
  return (
    /^0{8,}/i.test(token) ||
    /^f{8,}/i.test(token) ||
    token.toLowerCase().includes("test")
  );
}

// --- handler ---
export default async function handler(req) {
  try {
    // 有些平台會用 GET hit endpoint；直接 200
    if (req.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const bodyText = await req.text();
    const signature = req.headers.get("x-line-signature");

    // 驗簽不過：直接回 200（讓 Verify 不報錯）
    if (!validateSignature(bodyText, signature)) {
      return new Response("OK", { status: 200 });
    }

    // 解析 JSON（失敗也回 200）
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return new Response("OK", { status: 200 });
    }

    const events = Array.isArray(parsed?.events) ? parsed.events : [];
    if (events.length === 0) {
      return new Response("OK", { status: 200 });
    }

    // 處理事件（所有錯誤都吞掉）
    await Promise.all(
      events.map(async (ev) => {
        try {
          if (ev.type !== "message" || ev.message?.type !== "text") return;

          const replyToken = ev.replyToken || "";
          if (isTestReplyToken(replyToken)) return; // 不回覆測試 token

          const text = (ev.message?.text || "").trim();
          const userId = ev.source?.userId || "-";

          if (/^status$/i.test(text)) {
            await safeReply(replyToken, [
              {
                type: "text",
                text: `✅ Bot online\nuserId: ${userId}\nLAT:${process.env.LAT ?? "-"} LON:${process.env.LON ?? "-"}`,
              },
            ]);
            return;
          }

          await safeReply(replyToken, [
            {
              type: "text",
              text: `指令：\nstatus － 檢查連線並顯示你的 userId`,
            },
          ]);
        } catch (e) {
          console.error("event error:", e);
        }
      })
    );

    // 永遠回 200，避免 500
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("handler error:", e);
    // 就算這裡出錯也回 200，讓 Verify 不失敗
    return new Response("OK", { status: 200 });
  }
}
