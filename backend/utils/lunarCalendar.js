const { Solar } = require('lunar-javascript');

// Converts a Gregorian y/m/d (as plain ints, no timezone ambiguity) into the
// Chinese lunar calendar fields shown on a traditional tear-away desk calendar.
function getLunarInfo(year, month, day) {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  return {
    lunarMonthDay: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearGanZhi: lunar.getYearInGanZhi(),
    zodiac: lunar.getYearShengXiao(),
    weekdayChinese: `星期${solar.getWeekInChinese()}`,
  };
}

module.exports = { getLunarInfo };
