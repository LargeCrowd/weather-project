const { Solar, LunarMonth } = require('lunar-javascript');

// Converts a Gregorian y/m/d (as plain ints, no timezone ambiguity) into the
// Chinese lunar calendar fields shown on a traditional tear-away desk calendar.
function getLunarInfo(year, month, day) {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const lunarMonthDayCount = LunarMonth.fromYm(lunar.getYear(), lunar.getMonth()).getDayCount();

  return {
    lunarMonthDay: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    // Day/month split out separately (mono panel just uses lunarMonthDay
    // above; the color panel's date row shows the day on its own, bigger).
    lunarDay: lunar.getDayInChinese(),
    lunarMonth: lunar.getMonthInChinese(),
    // 大 for a 30-day lunar month, 小 for 29 - a lunar month (unlike the
    // Gregorian chineseMonthLabel in chineseMonth.js) is always one or the
    // other, never a third "平" case.
    lunarMonthSize: lunarMonthDayCount === 30 ? '大' : '小',
    // Only the year pillar is kept - month/day ganzhi (BaZi-style pillars)
    // were tried and dropped to avoid any fengshui/astrology association.
    yearGanZhi: lunar.getYearInGanZhi(),
    zodiac: lunar.getYearShengXiao(),
    weekdayChinese: `星期${solar.getWeekInChinese()}`,
    // Non-empty only on the exact day a solar term begins (e.g. "白露");
    // empty string on every other day, in which case the ribbon falls
    // back to a scripture phrase instead - see getCalendarData.
    solarTerm: lunar.getJieQi(),
  };
}

module.exports = { getLunarInfo };
