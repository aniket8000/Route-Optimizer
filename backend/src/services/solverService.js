import axios from "axios";

const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8000";

// durationMatrix: NxN seconds -> returns { order, totalDuration }
export async function solveRoute(durationMatrix, depotIndex = 0) {
  try {
    const { data } = await axios.post(`${SOLVER_URL}/optimize`, {
      duration_matrix: durationMatrix,
      depot_index: depotIndex,
    });

    return {
      order: data.order,
      totalDuration: data.total_duration,
    };
  } catch (err) {
    // tag which upstream call actually failed - a bare "404" is useless on its own
    throw new Error(`solver-service request failed (${SOLVER_URL}/optimize): ${err.message}`);
  }
}
