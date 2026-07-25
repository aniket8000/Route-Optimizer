import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MapView.css";

const DEFAULT_CENTER = [28.6139, 77.209]; // New Delhi, fallback if geolocation isn't available

// leaflet's default markers are ugly little blue blobs - draw our own numbered pins instead
function numberedIcon(number, isDepot) {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${isDepot ? "pin-depot" : ""}"><span>${number}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

const userLocationIcon = L.divIcon({
  className: "",
  html: `<div class="user-dot"><div class="user-dot-pulse"></div></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// leaflet only recalculates its size on a real browser window resize - dragging the
// sidebar resizes this container via react state instead, which leaflet never notices
// on its own, leaving stale/blank tiles until you nudge the window. watch it directly.
function ResizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

// asks the browser where the user is, then flies the map there once - doesn't touch it again
// so it doesn't yank the view around while someone's clicking stops
function LocateUser({ onLocated }) {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // desktop browsers guess location from nearby wifi networks, not gps - accuracy
        // varies wildly, so we keep it and show a circle instead of pretending it's exact
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        map.flyTo([loc.lat, loc.lng], 17, { duration: 1.5 });
        onLocated(loc);
      },
      (err) => console.warn("couldn't get your location:", err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [map, onLocated]);

  return null;
}

// keeps every stop visible as they're added - single stop just pans there,
// two or more zooms out to fit them all with some breathing room. clearing back
// to zero flies home to the user's location instead of leaving the map stranded
// wherever the last stop happened to be
function FitToStops({ positions, userLocation }) {
  const map = useMap();
  const hadStopsBefore = useRef(false);

  useEffect(() => {
    if (positions.length === 1) {
      map.flyTo(positions[0], 17, { duration: 1 });
    } else if (positions.length > 1) {
      map.flyToBounds(positions, { padding: [60, 60], maxZoom: 17, duration: 1 });
    } else if (hadStopsBefore.current && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 17, { duration: 1 });
    }

    hadStopsBefore.current = positions.length > 0;
  }, [map, JSON.stringify(positions), userLocation]);

  return null;
}

export default function MapView({ stops, order, onMapClick, onStopDrag }) {
  const [userLocation, setUserLocation] = useState(null);

  // if we have a solved order, draw the route in that order, otherwise just connect stops as-clicked
  const routeStops = order && order.length ? order.map((i) => stops[i]) : stops;
  const polylinePositions = routeStops.map((s) => [s.lat, s.lng]);

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={16} style={{ height: "100%", width: "100%" }}>
      {/* real satellite photos, like google maps' satellite view */}
      <TileLayer
        attribution="Tiles &copy; Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      {/* place/road name labels drawn on top, transparent everywhere else */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      <ResizeWatcher />
      <LocateUser onLocated={setUserLocation} />
      <FitToStops positions={polylinePositions} userLocation={userLocation} />

      {userLocation && (
        <>
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon} />
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={userLocation.accuracy}
            pathOptions={{ color: "#3b82f6", weight: 1, fillOpacity: 0.08 }}
          />
        </>
      )}

      {routeStops.map((stop, i) => (
        <Marker
          key={i}
          position={[stop.lat, stop.lng]}
          icon={numberedIcon(i + 1, i === 0)}
          draggable
          eventHandlers={{
            dragend: (e) => onStopDrag(i, e.target.getLatLng()),
          }}
        />
      ))}

      {polylinePositions.length > 1 && (
        <>
          {/* dark outline drawn first so the route reads clearly over busy satellite imagery */}
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: "#0f172a", weight: 7, opacity: 0.7 }}
          />
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#fb923c",
              weight: 4,
              opacity: 1,
              dashArray: "1 10",
              className: "route-line",
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
