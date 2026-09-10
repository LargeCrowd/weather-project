const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

// Chinese label for a Gregorian month, e.g. "一月大" for January: the numeral
// name plus a size marker - 大 (big) for 31-day months, 小 (small) for 30-day
// months, 平 (even/plain) for February's 28/29 days.
function getChineseMonthLabel(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const sizeLabel = daysInMonth === 31 ? '大' : daysInMonth === 30 ? '小' : '平';
  return `${CHINESE_NUMERALS[month - 1]}月${sizeLabel}`;
}

module.exports = { getChineseMonthLabel };
