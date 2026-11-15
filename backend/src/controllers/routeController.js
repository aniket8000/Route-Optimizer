import mongoose from "mongoose";
import Route from "../models/Route.js";
import { getDurationMatrix } from "../services/osrmService.js";
import { solveRoute } from "../services/solverService.js";
import { errorResponse } from "../utils/errorResponse.js";

const MAX_STOPS = 15;

// a stop with missing or junk coords would otherwise go all the way to OSRM as
// "undefined,undefined" and come back as a confusing 500
function isValidStop(stop) {
  return (
    stop != null &&
    typeof stop.lat === "number" &&
    typeof stop.lng === "number" &&
    Math.abs(stop.lat) <= 90 &&
    Math.abs(stop.lng) <= 180
  );
}

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
    if (!stops.every(isValidStop)) {
      return res.status(400).json({ error: "every stop needs a valid lat and lng" });
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
    res.status(500).json(errorResponse("couldn't optimize route", err));
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
    // missing/malformed fields are the client's fault, not a server error
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json(errorResponse("route data is incomplete or invalid", err));
    }
    console.error("saveRoute failed:", err.message);
    res.status(500).json(errorResponse("couldn't save route", err));
  }
}

// GET /api/routes - requires auth, only returns the logged-in user's routes
export async function listRoutes(req, res) {
  try {
    const routes = await Route.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(routes);
  } catch (err) {
    console.error("listRoutes failed:", err.message);
    res.status(500).json(errorResponse("couldn't fetch routes", err));
  }
}

// DELETE /api/routes/:id - requires auth, only deletes routes the user owns
export async function deleteRoute(req, res) {
  // a malformed id can't match anything - answer that directly instead of letting
  // mongoose throw a CastError that turns into a 500
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "route not found" });
  }
  try {
    const route = await Route.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!route) {
      return res.status(404).json({ error: "route not found" });
    }
    res.status(204).end();
  } catch (err) {
    console.error("deleteRoute failed:", err.message);
    res.status(500).json(errorResponse("couldn't delete route", err));
  }
}
