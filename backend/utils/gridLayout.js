// Label dictionaries shared by renderInfoBoard in generateSVGColor.js -
// that function reads weather data directly and composes the board itself
// (see its own comment for why: the board's layout is too specific a shape
// for a generic config-driven grid), so this file is now just translated
// text, not layout config.

// Pollutant abbreviations (PSI/PM2.5/PM10/O3/SO2/CO/NO2) are used as-is in
// Chinese-language weather reports too, so those aren't translated - only
// the descriptive labels are.
const GRID_LABELS = {
  en: {
    high: 'HIGH', low: 'LOW', feelsLike: 'FEELS LIKE', humidity: 'HUMIDITY',
    liveTemp: 'LIVE TEMP', liveHumidity: 'LIVE HUMIDITY', rainfall: 'RAINFALL', uv: 'UV INDEX',
    windDir: 'WIND DIR', windSpd: 'WIND SPD', liveWindDir: 'LIVE WIND DIR', liveWindSpd: 'LIVE WIND SPD',
    updated: 'UPDATED', sunrise: 'SUNRISE', sunset: 'SUNSET', moonPhase: 'MOON PHASE',
    // aqiTitle is a 2-line stacked banner (its own column, spanning both the
    // header and value row heights) rather than a single-row header -
    // aqiRating is the actual qualitative-value column's header, next to it.
    aqiTitle: ['AIR', 'QUALITY'], aqiRating: 'RATING', mrtStatus: 'MRT STATUS',
  },
  zh: {
    high: '最高', low: '最低', feelsLike: '体感', humidity: '湿度',
    liveTemp: '气温', liveHumidity: '湿度', rainfall: '雨量', uv: '紫外线',
    windDir: '风向', windSpd: '风速', liveWindDir: '风向', liveWindSpd: '风速',
    updated: '刷新时间', sunrise: '日出', sunset: '日落', moonPhase: '月相',
    aqiTitle: ['空气', '品质'], aqiRating: '等级', mrtStatus: '地铁状况',
  },
};

// Qualitative advisory bands (NEA's official UV Index and PSI categories)
// and moon phase names, keyed to match getUvLevelKey/getPsiLevelKey/
// getMoonPhaseKey's band keys (advisoryLabels.js / astronomy.js).
const UV_LEVEL_LABELS = {
  en: { low: 'Low', moderate: 'Moderate', high: 'High', veryHigh: 'Very High', extreme: 'Extreme' },
  zh: { low: '低', moderate: '中等', high: '高', veryHigh: '很高', extreme: '极高' },
};

const AQI_LEVEL_LABELS = {
  en: { good: 'Good', moderate: 'Moderate', unhealthy: 'Unhealthy', veryUnhealthy: 'Very Unhealthy', hazardous: 'Hazardous' },
  zh: { good: '空气良好', moderate: '中等', unhealthy: '不健康', veryUnhealthy: '非常不健康', hazardous: '危害' },
};

const MOON_PHASE_LABELS = {
  en: {
    newMoon: 'New Moon', waxingCrescent: 'Waxing Crescent', firstQuarter: 'First Quarter',
    waxingGibbous: 'Waxing Gibbous', fullMoon: 'Full Moon', waningGibbous: 'Waning Gibbous',
    lastQuarter: 'Last Quarter', waningCrescent: 'Waning Crescent',
  },
  zh: {
    newMoon: '新月', waxingCrescent: '娥眉月', firstQuarter: '上弦月',
    waxingGibbous: '盈凸月', fullMoon: '满月', waningGibbous: '亏凸月',
    lastQuarter: '下弦月', waningCrescent: '残月',
  },
};

module.exports = { GRID_LABELS, UV_LEVEL_LABELS, AQI_LEVEL_LABELS, MOON_PHASE_LABELS };
