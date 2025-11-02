const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;

// 🪴 真柏月計畫
function monthlyPlan(month) {
  const plans = {
    1: "❄️ 一月：氣溫偏低，減少澆水量，避免凍害，可進行整枝與清理苔蘚。",
    2: "🌤️ 二月：氣候漸暖，修剪老枝，逐步增加日照與通風。",
    3: "🌱 三月：春芽萌發期，加強施肥與澆水，避免夜間低溫。",
    4: "🌿 四月：生長旺盛期，修剪與換盆最佳時機。",
    5: "☀️ 五月：日照強烈，須加強遮陰與噴霧保濕。",
    6: "🔥 六月：高溫高濕，注意通風與病蟲害防治。",
    7: "🌞 七月：強紫外線，避免中午直曬，控制肥料濃度。",
    8: "🌤️ 八月：維持良好通風，修剪第二輪新梢。",
    9: "🍂 九月：開始減少施肥，準備入秋，促進木質化。",
    10: "🍁 十月：可進行輕度修剪，減少澆水。",
    11: "🌧️ 十一月：氣溫下降，進入休眠期，避免過濕。",
    12: "🎄 十二月：全面休眠期，減少施肥與澆水。",
  };
  return plans[month] || "🌳 本月無特別建議，維持日常照護即可。";
}

// 🌦️ 根據天氣給每日建議
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

// 📨 推播訊息
async function pushMessage(message) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: USER_ID,
      messages: [{ type: "text", text: message }],
    }),
  });
}

// ---- 主 handler ----
export default async function handler(req, res) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const hour = now.getHours();

  try {
    // 每月初推播月計畫
    if (req.query.type === "month") {
      const plan = monthlyPlan(month);
      await pushMessage(`📅【${month}月真柏月計畫】\n${plan}`);
      return res.status(200).send("Monthly plan sent");
    }

    // 每日推播當天氣象建議
    if (req.query.type === "daily") {
      const w = await fetchWeather();
      const tips = bonsaiAdvice(w.temp, w.humid, w.uv, w.wind, w.rain);
      const msg = `🌤️【高雄今日天氣】\n🌡️ ${w.temp}°C　💧${w.humid}%　☀️UV ${w.uv}\n💨風速 ${w.wind} km/h　🌧️降雨 ${w.rain}%\n\n🌳【真柏建議】\n${tips}`;
      await pushMessage(msg);
      return res.status(200).send("Daily bonsai weather sent");
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Push failed");
  }
}

