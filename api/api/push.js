import { bonsaiAdvice } from '../lib/advice.js';

const TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;
const LAT = process.env.LAT;
const LON = process.env.LON;

async function fetchWeather(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'Asia/Taipei',
    hourly: 'relative_humidity_2m',
    daily: 'temperature_2m_max,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max'
  }).toString();
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('weather fetch failed');
  return res.json();
}

async function push(to, message) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: message }] })
  });
}

export default async function handler() {
  try {
    if (!USER_ID) throw new Error('USER_ID not set');
    const data = await fetchWeather(LAT, LON);
    const a = bonsaiAdvice(data);
    const msg = `${a.header}\n${a.text}\n— 09:00 自動播報`;
    await push(USER_ID, msg);
    return new Response('pushed', { status: 200 });
  } catch (e) {
    if (TOKEN && USER_ID) {
      await push(USER_ID, `⚠️ 推播錯誤：${e.message}`);
    }
    return new Response(e.message, { status: 500 });
  }
}
