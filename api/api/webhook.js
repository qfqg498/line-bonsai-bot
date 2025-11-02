// ✅ 強制使用 Node.js runtime（非 Edge）
export const config = {
  runtime: "nodejs",
};

import crypto from "crypto";

// === 環境變數 ===
const CHANNEL_SECRET = process.env.CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN || "";

// === 簽章驗證 ===
function validateSignature(body, signature) {
  try {
    if (!signature) return false; // Verify 時可能不帶簽章
    const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
    hmac.update(body);
    const expected = hmac.digest("base64");
    return expected === signature;
  } catch (err) {
    console.error("Signature validation error:", err);
    return false;
  }
}

// === 安全回覆 ===
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
    console.error("Reply error:", e);
  }
}

// === 測試事件 Token 檢查 ===
function isTestReplyToken(token = "") {
  return (
    /^0{8,}/i.test(token) ||
    /^f{8,}/i.test(token) ||
    token.toLowerCase().includes("test")
  );
}

// === 主處理函式 ===
export default async function handler(req, res) {
  try {
    // ✅ LINE Verify 會送 GET 請求：直接回 200
    if (req.method !== "POST") {
      return res.status(200).send("OK");
    }

    // 取得原始 body & header
    const bodyText = req.body ? JSON.stringify(req.body) : await getRawBody(req);
    const signature = req.headers["x-line-signature"];

    // 驗簽不通過：回 200 不報錯
    if (!validateSignature(bodyText, signature)) {
      return res.status(200).send("OK");
    }

    // 解析事件
    const parsed = typeof req.body === "object" ? req.body : JSON.parse(bodyText);
    const events = Array.isArray(parsed?.events) ? parsed.events : [];

    if (events.length === 0) return res.status(200).send("OK");

    // === 處理所有事件 ===
    await Promise.all(
      events.map(async (ev) => {
        try {
          if (ev.type !== "message" || ev.message?.type !== "text") return;

          const replyToken = ev.replyToken || "";
          if (isTestReplyToken(replyToken)) return;

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
          console.error("Event handling error:", e);
        }
      })
    );

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(200).send("OK");
  }
}

// === Utility：若 body 沒自動 parse，用這個讀原始文字 ===
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
