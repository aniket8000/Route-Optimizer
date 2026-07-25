import Route from "../models/Route.js";
import { getDurationMatrix } from "../services/osrmService.js";
import { solveRoute } from "../services/solverService.js";

const MAX_STOPS = 15;

// POST /api/routes/optimize
export async function optimizeRoute(req, res) {
  try {
    const { stops } = req.body;

    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ error: "need at least 2 stops" });
    }
    if (stops.length > MAX_STOPS) {
      return res.status(400).json({ error: `max ${MAX_STOPS} stops at a time` });
    }

    const { durations, distances } = await getDurationMatrix(stops);
    const { order } = await solveRoute(durations);

    // solver returns an open path now - driver ends at the last stop, no drive back
    // to the depot - so legs are just consecutive pairs, one shorter than the stop count
    const legs = order.slice(0, -1).map((fromIdx, i) => {
      const toIdx = order[i + 1];
      return {
        from: fromIdx,
        to: toIdx,
        duration: durations[fromIdx][toIdx],
        distance: distances[fromIdx][toIdx],
      };
    });
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);

    res.json({ stops, order, legs, totalDuration, totalDistance });
  } catch (err) {
    console.error("optimizeRoute failed:", err.message);
    res.status(500).json({ error: "couldn't optimize route", details: err.message });
  }
}

// POST /api/routes - requires auth
export async function saveRoute(req, res) {
  try {
    const { driverName, stops, order, legs, totalDuration, totalDistance } = req.body;
    const route = await Route.create({
      userId: req.userId,
      driverName,
      stops,
      order,
      legs,
      totalDuration,
      totalDistance,
    });
    res.status(201).json(route);
  } catch (err) {
    console.error("saveRoute failed:", err.message);
    res.status(500).json({ error: "couldn't save route", details: err.message });
  }
}

// GET /api/routes - requires auth, only returns the logged-in user's routes
export async function listRoutes(req, res) {
  try {
    const routes = await Route.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(routes);
  } catch (err) {
    console.error("listRoutes failed:", err.message);
    res.status(500).json({ error: "couldn't fetch routes", details: err.message });
  }
}

// DELETE /api/routes/:id - requires auth, only deletes routes the user owns
export async function deleteRoute(req, res) {
  try {
    const route = await Route.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!route) {
      return res.status(404).json({ error: "route not found" });
    }
    res.status(204).end();
  } catch (err) {
    console.error("deleteRoute failed:", err.message);
    res.status(500).json({ error: "couldn't delete route", details: err.message });
  }
}
