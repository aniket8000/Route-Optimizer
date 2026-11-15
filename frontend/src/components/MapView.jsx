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
function FitToStops({ positions, userLocation, insets }) {
  const map = useMap();
  const hadStopsBefore = useRef(false);

  // on mobile the search bar and bottom sheet float over the map - keep pins out from
  // under them. kept in a ref so the sheet resizing doesn't make the map fly around
  const insetsRef = useRef(insets);
  useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);

  // positions is a fresh array on every render, so depend on its contents instead -
  // otherwise the map would re-fly every time anything in the app re-rendered
  const positionsKey = JSON.stringify(positions);

  useEffect(() => {
    const positions = JSON.parse(positionsKey);
    if (positions.length === 1) {
      map.flyTo(positions[0], 17, { duration: 1 });
    } else if (positions.length > 1) {
      const { top = 0, bottom = 0 } = insetsRef.current || {};
      map.flyToBounds(positions, {
        paddingTopLeft: [60, 60 + top],
        paddingBottomRight: [60, 60 + bottom],
        maxZoom: 17,
        duration: 1,
      });
    } else if (hadStopsBefore.current && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 17, { duration: 1 });
    }

    hadStopsBefore.current = positions.length > 0;
  }, [map, positionsKey, userLocation]);

  return null;
}

// floating "where am i" button - re-centres on the rider's location, asking the browser
// again if we didn't get it the first time
function LocateButton({ userLocation, onLocated }) {
  const map = useMap();
  const ref = useRef(null);
  const [locating, setLocating] = useState(false);

  // this sits inside the map, so without this every tap on it would also drop a stop
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  function handleClick() {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 17, { duration: 1 });
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        onLocated(loc);
        map.flyTo([loc.lat, loc.lng], 17, { duration: 1 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`map-fab ${locating ? "is-locating" : ""}`}
      onClick={handleClick}
      aria-label="Show my location"
      title="Show my location"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}

export default function MapView({ stops, order, onMapClick, onStopDrag, insets }) {
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
      {/* road names, then place names, drawn over the photos (transparent everywhere else).
          these used to be CARTO's label tiles, but CARTO now serves an "API KEY REQUIRED"
          watermark instead of labels without a key - esri's reference layers are still open */}
      <TileLayer
        attribution='Labels &copy; Esri · Search &amp; routing &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
      <ClickHandler onMapClick={onMapClick} />
      <ResizeWatcher />
      <LocateUser onLocated={setUserLocation} />
      <FitToStops positions={polylinePositions} userLocation={userLocation} insets={insets} />
      <LocateButton userLocation={userLocation} onLocated={setUserLocation} />

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
