export function bonsaiAdvice(data) {
  const t = data.daily.temperature_2m_max[0];
  const rainProb = data.daily.precipitation_probability_max?.[0] ?? 0;
  const rainSum = data.daily.precipitation_sum?.[0] ?? 0;
  const uv = data.daily.uv_index_max?.[0] ?? 0;
  const wind = data.daily.wind_gusts_10m_max?.[0] ?? data.daily.wind_speed_10m_max?.[0] ?? 0;

  // 白天(9~17)平均濕度
  const hrs = data.hourly.time
    .map((_, i) => [data.hourly.time[i], data.hourly.relative_humidity_2m[i]])
    .filter(([iso]) => {
      const h = new Date(iso).getHours();
      return h >= 9 && h <= 17;
    })
    .map(([, rh]) => rh);
  const rh = Math.round(hrs.reduce((a,b)=>a+b,0) / Math.max(hrs.length,1));

  const notes = [];
  if (rainProb >= 60 || rainSum >= 5) notes.push('🌧 降雨高：**今天先別預澆**，雨後再看表土。');
  else if (t >= 32 && rh < 60 && uv >= 8) notes.push('🥵 炎熱乾：中午乾很快，表土 1–2cm 乾就澆透；傍晚再檢。');
  else notes.push('💧 例行：表土 1–2cm 乾再澆，一次澆透。');

  if (uv >= 9) notes.push('🕶 UV 高：中午遮陰 20–30%。');
  else notes.push('☀️ 確保日照 6h+。');

  if (wind >= 12) notes.push('💨 風大：移避風處、檢查蟠線與盆線固定。');
  if (t >= 28 && rh <= 55) notes.push('🕷 乾熱：紅蜘蛛風險，背面噴霧洗塵、注意退綠點。');
  if (rh >= 80) notes.push('🦠 濕悶：減少噴霧、加強通風，避免悶根。');

  notes.push('🧵 蟠線：每週拍照檢查勒痕；膨皮立即鬆線重繞。');
  notes.push('✂️ 今日僅清枯黃針；避免摘軟梢。');

  const header = `🪴 系魚川真柏｜今日照護建議
🌡 ${t}°C｜UV ${uv}｜降雨 ${rainProb}%｜雨量 ${rainSum}mm｜陣風 ${wind}m/s｜濕度約 ${rh}%`;
  return { header, text: notes.join('\n') };
}
