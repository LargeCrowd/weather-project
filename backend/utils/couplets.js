const couplets = require('../assets/data/couplets.json');

// Picks a stable "couplet of the day" for the vertical scripture couplet
// flanking the big day number - same one all day, cycling through the
// list by absolute day count (same technique as scripturePhrases.js).
function getCoupletOfTheDay(year, month, day) {
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return couplets[daysSinceEpoch % couplets.length];
}

module.exports = { getCoupletOfTheDay };
