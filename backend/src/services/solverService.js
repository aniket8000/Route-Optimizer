import axios from "axios";

const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8000";
// generous on purpose - on render's free tier a sleeping solver can take close to a
// minute to wake up, and we don't want to cut off a request that would've succeeded
const SOLVER_TIMEOUT_MS = 90_000;

// durationMatrix: NxN seconds -> returns { order, totalDuration }
export async function solveRoute(durationMatrix, depotIndex = 0) {
  try {
    const { data } = await axios.post(
      `${SOLVER_URL}/optimize`,
      { duration_matrix: durationMatrix, depot_index: depotIndex },
      { timeout: SOLVER_TIMEOUT_MS }
    );

    return {
      order: data.order,
      totalDuration: data.total_duration,
    };
  } catch (err) {
    // tag which upstream call actually failed - a bare "404" is useless on its own
    throw new Error(`solver-service request failed (${SOLVER_URL}/optimize): ${err.message}`);
  }
}
