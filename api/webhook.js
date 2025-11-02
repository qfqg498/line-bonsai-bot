export default async function handler(req, res) {
  // 先立即回應 LINE，避免 timeout
  res.status(200).send("OK");

  try {
    // 後續邏輯放這裡（非同步處理）
    const event = req.body.events?.[0];
    if (!event) return;

    const userMessage = event.message?.text || "";

    if (userMessage.includes("真柏")) {
      const weather = await fetchWeather();
      const tips = bonsaiAdvice(
        weather.temp,
        weather.humid,
        weather.uv,
        weather.wind,
        weather.rain
      );

      const reply = `🌳【今日高雄天氣】\n🌡️${weather.temp}°C 💧${weather.humid}% ☀️UV ${weather.uv}\n💨${weather.wind} km/h 🌧️${weather.rain}%\n\n🪴【真柏照護建議】\n${tips}`;

      await replyMessage(event.replyToken, reply);
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }
}

import crypto from "crypto";

const CHANNEL_SECRET = process.env.CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN || "";

// 🌦️ 抓取天氣
async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,uv_index,wind_speed_10m,precipitation&hourly=precipitation_probability&timezone=Asia/Taipei`
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
  } catch (err) {
    console.error("Weather fetch failed:", err);
    return null;
  }
}

// 🌳 真柏建議
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

// 驗證簽章
function validateSignature(body, signature) {
  try {
    const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
    hmac.update(body);
    const expected = hmac.digest("base64");
    return expected === signature;
  } catch (e) {
    console.error("Signature validation failed:", e);
    return false;
  }
}

// 回覆訊息
async function replyMessage(replyToken, messages) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
    console.log("LINE reply status:", res.status);
    if (!res.ok) {
      const txt = await res.text();
      console.error("LINE reply error:", txt);
    }
  } catch (err) {
    console.error("replyMessage error:", err);
  }
}

// --- 主 handler ---
export default async function handler(req) {
  try {
    if (req.method !== "POST") return new Response("OK", { status: 200 });

    const bodyText = await req.text();
    const signature = req.headers.get("x-line-signature");

    // ✅ 先回 200 給 LINE，避免 Timeout
    const response = new Response("OK", { status: 200 });

    // 背景 async 處理
    (async () => {
      try {
        if (!validateSignature(bodyText, signature)) {
          console.error("Invalid signature");
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          console.error("JSON parse error");
          return;
        }

        const events = Array.isArray(parsed.events) ? parsed.events : [];
        for (const ev of events) {
          if (ev.type !== "message" || ev.message.type !== "text") continue;

          const text = ev.message.text.trim();
          if (/真柏/i.test(text)) {
            const isChanghua = /彰化/.test(text);
            const city = isChanghua ? "彰化" : "高雄";
            const lat = isChanghua ? 24.08 : 22.63;
            const lon = isChanghua ? 120.54 : 120.30;

            const w = await fetchWeather(lat, lon);
            if (!w) {
              await replyMessage(ev.replyToken, [
                { type: "text", text: "❌ 無法取得天氣資料，請稍後再試。" },
              ]);
              return;
            }

            const tips = bonsaiAdvice(w.temp, w.humid, w.uv, w.wind, w.rain);
            const msg = `🌤️【${city}今日天氣】\n🌡️ ${w.temp}°C　💧${w.humid}%　☀️UV ${w.uv}\n💨風速 ${w.wind} km/h　🌧️降雨 ${w.rain}%\n\n🌳【真柏照護建議】\n${tips}`;
            await replyMessage(ev.replyToken, [{ type: "text", text: msg }]);
          } else {
            await replyMessage(ev.replyToken, [
              {
                type: "text",
                text: "請輸入「真柏」或「彰化真柏」即可查看今日天氣與照護建議 🌳",
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Async webhook error:", err);
      }
    })();

    return response; // ✅ 永遠先回 200 給 LINE
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response("OK", { status: 200 });
  }
}
