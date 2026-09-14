const axios = require('axios');

const BUS_ARRIVAL_URL = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival';
const TRAIN_ALERTS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts';

function authHeaders() {
  return { AccountKey: process.env.LTA_DATAMALL_API_KEY, accept: 'application/json' };
}

function minutesUntil(isoString) {
  if (!isoString) return null;
  return Math.max(0, Math.round((new Date(isoString).getTime() - Date.now()) / 60000));
}

// Next-arrival countdowns for every bus service at a stop, each paired
// with its crowding level (LTA's Load field: SEA = seats available,
// SDA = standing available, LSD = limited standing/very crowded), e.g.
// [{ serviceNo: '112', arrivals: [{ minutes: 3, load: 'SEA' }, ...] }, ...].
// Falls back to an empty list on any failure (missing/invalid key, LTA
// outage) rather than breaking the whole page render.
async function getBusArrivals(busStopCode) {
  try {
    const res = await axios.get(BUS_ARRIVAL_URL, {
      params: { BusStopCode: busStopCode },
      headers: authHeaders(),
    });

    return (res.data.Services || []).map((service) => ({
      serviceNo: service.ServiceNo,
      arrivals: [service.NextBus, service.NextBus2, service.NextBus3]
        .map((bus) => ({ minutes: minutesUntil(bus?.EstimatedArrival), load: bus?.Load }))
        .filter((arrival) => arrival.minutes !== null),
    }));
  } catch (err) {
    console.error('Failed to load bus arrivals, showing none:', err.message);
    return [];
  }
}

// MRT network status: Status 1 = Normal, 2 = a disruption is active (with
// AffectedSegments naming which line(s)/direction). Falls back to "normal"
// on any failure, rather than falsely reporting a disruption.
async function getMrtLineHealth() {
  try {
    const res = await axios.get(TRAIN_ALERTS_URL, { headers: authHeaders() });
    const { Status, AffectedSegments } = res.data.value;

    if (Status === 1) return { normal: true, affectedLines: [] };

    const affectedLines = [...new Set((AffectedSegments || []).map((seg) => seg.Line))];
    return { normal: false, affectedLines };
  } catch (err) {
    console.error('Failed to load MRT line health, assuming normal:', err.message);
    return { normal: true, affectedLines: [] };
  }
}

module.exports = { getBusArrivals, getMrtLineHealth };
