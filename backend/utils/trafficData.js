const axios = require('axios');

const EST_TRAVEL_TIMES_URL = 'https://datamall2.mytransport.sg/ltaodataservice/EstTravelTimes';
const TRAFFIC_INCIDENTS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents';

function authHeaders() {
  return { AccountKey: process.env.LTA_DATAMALL_API_KEY, accept: 'application/json' };
}

// The 8 expressways LTA's EstTravelTimes covers, each with its 2 directions.
// `shortDest` is just the display label (where that direction leads, for
// the grid cell); `matchKeywords` is separately tuned to how LTA's
// TrafficIncidents messages actually phrase directions (e.g. "towards
// W'lands", "towards SLE") - which don't always match EstTravelTimes' own
// FarEndPoint wording (e.g. "WOODLANDS CENTRE"), so the two are kept
// distinct rather than derived from one string. Order here is just fetch
// order; display placement is controlled by renderInfoBoard in
// generateSVGColor.js (this array's order maps directly onto its 4
// traffic-entry rows, 4 per row).
const EXPRESSWAY_DIRECTIONS = [
  { name: 'AYE', direction: 2, shortDest: 'City', matchKeywords: ['CITY'] },
  { name: 'AYE', direction: 1, shortDest: 'Tuas', matchKeywords: ['TUAS'] },
  { name: 'BKE', direction: 2, shortDest: 'PIE', matchKeywords: ['PIE'] },
  { name: 'BKE', direction: 1, shortDest: "W'lands", matchKeywords: ['WLANDS', 'WOODLANDS'] },
  { name: 'CTE', direction: 2, shortDest: 'City', matchKeywords: ['CITY'] },
  { name: 'CTE', direction: 1, shortDest: 'SLE', matchKeywords: ['SLE'] },
  { name: 'ECP', direction: 2, shortDest: 'Changi', matchKeywords: ['CHANGI'] },
  { name: 'ECP', direction: 1, shortDest: 'City', matchKeywords: ['CITY'] },
  { name: 'KJE', direction: 2, shortDest: 'BKE', matchKeywords: ['BKE'] },
  { name: 'KJE', direction: 1, shortDest: 'PIE', matchKeywords: ['PIE'] },
  { name: 'PIE', direction: 2, shortDest: 'Changi', matchKeywords: ['CHANGI'] },
  { name: 'PIE', direction: 1, shortDest: 'AYE', matchKeywords: ['AYE'] },
  { name: 'SLE', direction: 1, shortDest: 'BKE', matchKeywords: ['BKE'] },
  { name: 'SLE', direction: 2, shortDest: 'CTE', matchKeywords: ['CTE'] },
  { name: 'TPE', direction: 1, shortDest: 'CTE/SLE', matchKeywords: ['SLE', 'CTE'] },
  { name: 'TPE', direction: 2, shortDest: 'PIE', matchKeywords: ['PIE'] },
];

function normalizeToLetters(text) {
  return text.toUpperCase().replace(/[^A-Z]/g, '');
}

// Incident messages read like "(14/9)14:08 Road Works on PIE (towards
// Changi) at Jalan Eunos Exit." - this pulls out the expressway code and,
// when present, the "towards X" destination keyword (normalized to bare
// letters so e.g. "W'lands" compares cleanly against "WLANDS").
function parseIncidentMessage(message) {
  const match = message.match(/\bon ([A-Z]{2,4})\b(?: \(towards ([^)]+)\))?/);
  if (!match) return null;
  return { expressway: match[1], towards: match[2] ? normalizeToLetters(match[2]) : null };
}

// Estimated travel time (minutes) for each of the 8 expressways' 2
// directions, plus the incident type currently reported on that direction
// (e.g. "Roadwork", "Vehicle breakdown"), if any - straight from LTA's own
// Type field, not a made-up severity label, since no official "normal/
// heavy" band exists for travel time itself (unlike NEA's UV/PSI bands).
async function getExpresswayTraffic() {
  try {
    const [timesRes, incidentsRes] = await Promise.all([
      axios.get(EST_TRAVEL_TIMES_URL, { headers: authHeaders() }),
      axios.get(TRAFFIC_INCIDENTS_URL, { headers: authHeaders() }),
    ]);

    const minutesByRoute = new Map();
    for (const row of timesRes.data.value || []) {
      const key = `${row.Name}_${row.Direction}`;
      minutesByRoute.set(key, (minutesByRoute.get(key) || 0) + row.EstTime);
    }

    const incidents = (incidentsRes.data.value || [])
      .map((row) => ({ ...parseIncidentMessage(row.Message), type: row.Type }))
      .filter((incident) => incident && incident.expressway);

    return EXPRESSWAY_DIRECTIONS.map(({ name, direction, shortDest, matchKeywords }) => {
      const key = `${name}_${direction}`;
      const minutes = minutesByRoute.get(key) ?? null;

      // An incident applies to this direction if it named no direction at
      // all (applies to the whole expressway, both directions), or if its
      // "towards X" keyword matches one of this direction's own keywords -
      // NOT just because it matched the expressway in general, otherwise
      // an incident on the opposite direction would wrongly show up here.
      const applicable = incidents.filter((incident) => (
        incident.expressway === name
        && (incident.towards === null || matchKeywords.some((k) => incident.towards.includes(k)))
      ));
      const incidentType = applicable.length > 0 ? applicable[0].type : null;

      return { name, direction, shortDest, minutes, incidentType };
    });
  } catch (err) {
    console.error('Failed to load expressway traffic, showing none:', err.message);
    return EXPRESSWAY_DIRECTIONS.map(({ name, direction, shortDest }) => (
      { name, direction, shortDest, minutes: null, incidentType: null }
    ));
  }
}

module.exports = { getExpresswayTraffic };
