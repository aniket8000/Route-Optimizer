import axios from "axios";

const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8000";

// durationMatrix: NxN seconds -> returns { order, totalDuration }
export async function solveRoute(durationMatrix, depotIndex = 0) {
  const { data } = await axios.post(`${SOLVER_URL}/optimize`, {
    duration_matrix: durationMatrix,
    depot_index: depotIndex,
  });

  return {
    order: data.order,
    totalDuration: data.total_duration,
  };
}
