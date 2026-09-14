const phrases = require('../assets/data/scripture_phrases.json');

// Picks a stable "phrase of the day" for the ribbon on days that aren't a
// solar term - same phrase all day regardless of how many times the page
// is rendered, cycling through the list by absolute day count so it isn't
// tied to calendar-year boundaries.
function getPhraseOfTheDay(year, month, day) {
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return phrases[daysSinceEpoch % phrases.length].phrase;
}

module.exports = { getPhraseOfTheDay };
