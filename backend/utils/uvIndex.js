const { cachedGet } = require('./httpCache');

// UV index lives on data.gov.sg's older v1 API (a different host than the
// v2 real-time endpoints everything else here uses) - no API key required.
const NEA_UV_INDEX_URL = 'https://api.data.gov.sg/v1/environment/uv-index';

async function getUvIndexData() {
  const data = await cachedGet(NEA_UV_INDEX_URL);
  const latest = data.items[0].index[0];

  return { uvIndex: latest.value };
}

module.exports = { getUvIndexData };
