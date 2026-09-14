// Singapore's public holidays (data.gov.sg/MOM) only carry English names -
// there's no Chinese name in the dataset. The set of holidays is small and
// fixed, so this is a hand-maintained lookup rather than anything fetched.
const HOLIDAY_NAMES_ZH = {
  "New Year's Day": '元旦',
  'Chinese New Year': '农历新年',
  'Good Friday': '受难节',
  'Hari Raya Puasa': '开斋节',
  'Labour Day': '劳动节',
  'Vesak Day': '卫塞节',
  'Hari Raya Haji': '哈芝节',
  'National Day': '国庆日',
  'Deepavali': '屠妖节',
  'Christmas Day': '圣诞节',
};

// Strips a "(Observed)" suffix (used when a holiday falls on a weekend)
// before lookup, so the observed day shows the same name as the real one.
function translateHolidayName(englishName) {
  const base = englishName.replace(/\s*\(Observed\)\s*$/i, '');
  return HOLIDAY_NAMES_ZH[base] || englishName;
}

module.exports = { translateHolidayName };
