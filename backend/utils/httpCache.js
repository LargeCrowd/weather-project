const axios = require('axios');

// A tiny in-memory GET cache. The display only refreshes once a day (see
// esp32/color_13in3/code.ino), so there's no real need to hit data.gov.sg's
// free-tier API more than once every few minutes even during active
// development/preview use - this just avoids tripping their rate limit.
const cache = new Map();
const DEFAULT_TTL_MS = 2 * 60 * 1000;

// Optional: set DATA_GOV_SG_API_KEY in backend/.env to raise data.gov.sg's
// rate limit above the unauthenticated default. Get one at
// https://guide.data.gov.sg/developer-guide/api-overview/how-to-request-an-api-key
function apiKeyHeaders() {
  return process.env.DATA_GOV_SG_API_KEY
    ? { 'x-api-key': process.env.DATA_GOV_SG_API_KEY }
    : {};
}

async function cachedGet(url, ttlMs = DEFAULT_TTL_MS) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < ttlMs) {
    return cached.data;
  }

  const response = await axios.get(url, { headers: apiKeyHeaders() });
  cache.set(url, { data: response.data, time: Date.now() });
  return response.data;
}

module.exports = { cachedGet };
