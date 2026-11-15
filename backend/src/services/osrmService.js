import axios from "axios";

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
// the public server normally answers in a second or two - if it hangs, give up
// instead of leaving the user staring at a spinner forever
const OSRM_TIMEOUT_MS = 30_000;

// stops: [{ lat, lng }, ...] -> NxN matrices of driving seconds and meters between every pair
export async function getDurationMatrix(stops) {
  // OSRM wants lon,lat (backwards from how everyone else does it)
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coords}`;

  let data;
  try {
    ({ data } = await axios.get(url, {
      params: { annotations: "duration,distance" },
      timeout: OSRM_TIMEOUT_MS,
    }));
  } catch (err) {
    // tag which upstream call actually failed - a bare "404" is useless on its own
    throw new Error(`OSRM request failed (${url}): ${err.message}`);
  }

  if (data.code !== "Ok") {
    throw new Error(`OSRM error: ${data.code} - ${data.message || "no message"}`);
  }

  // the public OSRM server occasionally returns null or garbage (even negative)
  // values for very long-distance pairs - catch it here instead of letting a
  // corrupt route silently reach the solver and the user
  const isBadValue = (n) => n == null || !Number.isFinite(n) || n < 0;
  const hasBadData = [...data.durations, ...data.distances].some((row) => row.some(isBadValue));
  if (hasBadData) {
    throw new Error("couldn't get reliable driving data for these stops (they may be too far apart)");
  }

  return { durations: data.durations, distances: data.distances };
}
