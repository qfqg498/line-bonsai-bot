// webhook.js
import crypto from "crypto";

// 環境變數
const CHANNEL_SECRET = process.env.CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN || "";

// ✅ 高雄天氣 API（加上 timeout + retry）
async function fetchWeather(retry = 0) {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=22.63&longitude=120.30&current=temperature_2m,relative_humidity_2m,uv_index,wind_speed_10m,precipitation&hourly=precipitation_probability&timezone=Asia/Taipei";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 最多等 10 秒
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = data.current;
    const rain = data.hourly.precipitation_probability[0];
    return {
      temp: c.temperature_2m,
      humid: c.relative_humidity_2m,
      uv: c.uv_index,
      wind: c.wind_speed_10m,
      rain,
    };
  } catch (err) {
    console.error(`⚠️ fetchWeather failed (attempt ${retry + 1}):`, err);

    // 自動重試最多 2 次
    if (retry < 2) {
      await new Promise((r) => setTimeout(r, 1500)); // 等 1.5 秒再試
      return fetchWeather(retry + 1);
    }

    // 超過 2 次失敗 → 回傳預設值
    console.warn("⚠️ Weather API unavailable, using fallback values");
    return { temp: 25, humid: 60, uv: 5, wind: 10, rain: 20 };
  }
}

// ✅ 真柏照護建議
function bonsaiAdvice(temp, humidity, uv, wind, rain) {
  let msg = "";
  if (temp >= 33) msg += "🔥 高溫注意避曬、加強通風。\n";
  if (temp <= 15) msg += "🥶 溫度偏低，應減少澆水頻率。\n";
  if (humidity < 50) msg += "💧 空氣乾燥，建議早晚噴霧保持濕度。\n";
  if (uv >= 7) msg += "🌞 紫外線強，建議遮陽避免灼傷。\n";
  if (wind >= 25) msg += "💨 強風注意固定與防乾風。\n";
  if (rain >= 60) msg += "🌧️ 降雨高，減少澆水並檢查排水孔。\n";
  if (!msg) msg = "✅ 天氣穩定，維持日常管理即可。";
  return msg;
}

// ✅ 回覆訊息給 LINE
async function replyMessage(replyToken, text) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });

    const resultText = await res.text();
    console.log("📨 LINE reply result:", resultText);
  } catch (err) {
    console.error("❌ Reply error:", err);
  }
}

// ✅ Webhook 主處理
export default async function handler(req, res) {
  // 先回 200，避免 LINE timeout
  res.status(200).send("OK");

  try {
    const body = req.body || (await readBody(req));
    const event = body.events?.[0];
    if (!event || event.type !== "message") return;

    const text = event.message?.text?.trim() || "";
    console.log("💬 Received message:", text);

    if (text.includes("真柏")) {
      const w = await fetchWeather();
      const tips = bonsaiAdvice(w.temp, w.humid, w.uv, w.wind, w.rain);
      const reply = `🌤️【高雄今日天氣】\n🌡️ ${w.temp}°C　💧${w.humid}%　☀️UV ${w.uv}\n💨風速 ${w.wind} km/h　🌧️降雨 ${w.rain}%\n\n🌳【真柏照護建議】\n${tips}`;
      await replyMessage(event.replyToken, reply);
    }
  } catch (err) {
    console.error("Webhook Error:", err);
  }
}

// 📦 讀取原始 body（Vercel 不自動解析）
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString();
  return JSON.parse(rawBody || "{}");
}
