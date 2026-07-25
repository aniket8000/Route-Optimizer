// matches the cap enforced server-side in routeController.js - keep them in sync
export const MAX_STOPS = 15;

// search results come back as long addresses like "23, MG Road, Sector 14, Gurugram, Haryana, 122001, India"
// just keep the first couple of parts so the sidebar doesn't wrap onto 3 lines
export function shortLabel(stop) {
  if (stop.label) return stop.label.split(",").slice(0, 2).join(",").trim();
  return `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`;
}

export function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function formatDistance(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function googleMapsUrl(stops, order) {
  const path = order.map((i) => stops[i]);
  const origin = `${path[0].lat},${path[0].lng}`;
  const destination = `${path[path.length - 1].lat},${path[path.length - 1].lng}`;
  const waypoints = path
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join("|");

  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints) params.set("waypoints", waypoints);

  return `https://www.google.com/maps/dir/?${params}`;
}
