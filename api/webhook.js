// webhook.js
import crypto from "crypto";

// 讀取環境變數
const CHANNEL_SECRET = process.env.CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN || "";

// ✅ 天氣 API：高雄
async function fetchWeather() {
  const res = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=22.63&longitude=120.30&current=temperature_2m,relative_humidity_2m,uv_index,wind_speed_10m,precipitation&hourly=precipitation_probability&timezone=Asia/Taipei"
  );
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
}

// ✅ 真柏建議邏輯
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

// ✅ 回覆訊息
async function replyMessage(replyToken, text) {
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
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
  } catch (err) {
    console.error("Reply error:", err);
  }
}

// ✅ Webhook handler
export default async function handler(req, res) {
  // ⚡ 先回 200，避免 LINE timeout
  res.status(200).send("OK");

  try {
    const body = req.body || (await readBody(req));
    const event = body.events?.[0];
    if (!event || event.type !== "message") return;

    const text = event.message?.text?.trim() || "";
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

// 📦 補上 readBody（Vercel 預設不自動解析）
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString();
  return JSON.parse(rawBody || "{}");
}
