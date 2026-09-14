// NEA's 24-hour forecast text values, translated to Chinese. Not every
// possible NEA phrase is covered - falls back to the original English text
// for anything not in this list rather than showing nothing.
const NEA_WEATHER_TRANSLATIONS = {
  // Fair & Cloudy
  'Fair': '晴',
  'Fair (Day)': '晴',
  'Fair (Night)': '晴朗',
  'Fair and Warm': '晴热',
  'Partly Cloudy': '多云',
  'Partly Cloudy (Day)': '多云',
  'Partly Cloudy (Night)': '多云',
  'Cloudy': '阴天',
  'Hazy': '微霾',
  'Slightly Hazy': '轻微烟霾',
  'Windy': '有风',

  // Rain & Showers
  'Passing Showers': '短暂阵雨',
  'Light Showers': '小阵雨',
  'Showers': '阵雨',
  'Moderate Rain': '中雨',
  'Heavy Rain': '大雨',

  // Thundery Conditions
  'Thundery Showers': '雷阵雨',
  'Heavy Thundery Showers': '强雷阵雨',
  'Heavy Thundery Showers with Gusty Winds': '强雷阵雨伴狂风',

  // General fallback
  'Rain': '下雨',
};

function translateForecastText(forecastText) {
  return NEA_WEATHER_TRANSLATIONS[forecastText] || forecastText;
}

module.exports = { translateForecastText };
