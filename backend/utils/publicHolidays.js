const axios = require('axios');

// MOM's consolidated Singapore public holidays dataset (2020 onwards, updated
// annually) via data.gov.sg. No API key required.
const HOLIDAYS_URL =
  'https://data.gov.sg/api/action/datastore_search?resource_id=d_8ef23381f9417e4d4254ee8b4dcdb176&limit=200';

let holidayDatesPromise = null;

// Fetched once per process and cached - the dataset only changes annually,
// so there's no need to refetch it for every request.
function loadHolidayDates() {
  if (!holidayDatesPromise) {
    holidayDatesPromise = axios
      .get(HOLIDAYS_URL)
      .then((res) => new Set(res.data.result.records.map((record) => record.date)))
      .catch((err) => {
        console.error('Failed to load public holidays, treating dates as non-holidays:', err.message);
        holidayDatesPromise = null; // allow a retry on the next call
        return new Set();
      });
  }
  return holidayDatesPromise;
}

// dateStr must be 'YYYY-MM-DD'.
async function isPublicHoliday(dateStr) {
  const dates = await loadHolidayDates();
  return dates.has(dateStr);
}

module.exports = { isPublicHoliday };
