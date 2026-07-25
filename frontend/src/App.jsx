import { useEffect, useRef, useState } from "react";
import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import AuthModal from "./components/AuthModal";
import HistoryPanel from "./components/HistoryPanel";
import { optimizeRoute, saveRoute } from "./api";
import { useAuth } from "./context/AuthContext";
import { shortLabel, formatDuration, formatDistance, googleMapsUrl, MAX_STOPS } from "./routeUtils";
import "./App.css";

export default function App() {
  const { user, token, logout } = useAuth();

  const [stops, setStops] = useState([]);
  const [order, setOrder] = useState(null);
  const [legs, setLegs] = useState(null);
  const [totalDuration, setTotalDuration] = useState(null);
  const [totalDistance, setTotalDistance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [staleRoute, setStaleRoute] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const resizingRef = useRef(false);

  // the resize handle only makes sense on desktop - below that the sidebar stacks full-width
  // via a CSS media query, and a leftover inline width would override that (inline always
  // beats a class), so we only apply the inline width once we're actually above the breakpoint
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 769px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function startResize(e) {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onResize);
    document.addEventListener("mouseup", stopResize);
  }

  function onResize(e) {
    if (!resizingRef.current) return;
    setSidebarWidth(Math.min(640, Math.max(260, e.clientX)));
  }

  function stopResize() {
    resizingRef.current = false;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onResize);
    document.removeEventListener("mouseup", stopResize);
  }

  function resetSolvedRoute() {
    setOrder(null);
    setLegs(null);
    setTotalDuration(null);
    setTotalDistance(null);
    setSaved(false);
  }

  function addStop(point) {
    if (stops.length >= MAX_STOPS) {
      setError(`max ${MAX_STOPS} stops at a time`);
      return;
    }
    setError(null);
    setStops((prev) => [...prev, point]);
    resetSolvedRoute();
  }

  function removeStop(index) {
    // if we'd already solved a route, removing a stop makes that solution stale -
    // rather than silently keep showing the old (now wrong) route, flag it
    if (order) setStaleRoute(true);
    setStops((prev) => prev.filter((_, i) => i !== index));
    resetSolvedRoute();
  }

  // dragging a pin moves that stop - same "now stale" handling as removing one
  function moveStop(displayIndex, newPos) {
    const actualIndex = order ? order[displayIndex] : displayIndex;
    if (order) setStaleRoute(true);
    setStops((prev) => prev.map((s, i) => (i === actualIndex ? { lat: newPos.lat, lng: newPos.lng } : s)));
    resetSolvedRoute();
  }

  function clearStops() {
    setStops([]);
    resetSolvedRoute();
    setError(null);
    setStaleRoute(false);
  }

  // logging out shouldn't leave someone else's route sitting on the map for the next person
  function handleLogout() {
    logout();
    clearStops();
    setLoggedOut(true);
    setTimeout(() => setLoggedOut(false), 3000);
  }

  async function handleOptimize() {
    if (stops.length < 2) {
      setError("drop at least 2 stops on the map first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await optimizeRoute(stops);
      setOrder(result.order);
      setLegs(result.legs);
      setTotalDuration(result.totalDuration);
      setTotalDistance(result.totalDistance);
      setSaved(false);
      setStaleRoute(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function doSave(tokenOverride) {
    setError(null);
    try {
      await saveRoute(
        { driverName: user?.name || "Demo Driver", stops, order, legs, totalDuration, totalDistance },
        tokenOverride || token
      );
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  function handleSave() {
    if (!order) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    doSave();
  }

  // loads a saved route back onto the map/sidebar so it can be reviewed without leaving the app
  function previewRoute(route) {
    setStops(route.stops);
    setOrder(route.order);
    setLegs(route.legs);
    setTotalDuration(route.totalDuration);
    setTotalDistance(route.totalDistance);
    setStaleRoute(false);
    setSaved(false);
    setError(null);
    setShowHistory(false);
  }

  return (
    <div className="app">
      <aside className="sidebar" style={isDesktop ? { width: sidebarWidth } : undefined}>
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h4l2-7 4 14 2-7h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1>Route Optimizer</h1>
            <p className="subtitle">TSP solver for delivery routes</p>
          </div>
        </div>

        <div className="account-row">
          {user ? (
            <>
              <span className="account-name">Hi, {user.name}</span>
              <button className="link-btn" onClick={() => setShowHistory(true)}>
                My Routes
              </button>
              <button className="link-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <span className="account-name">Browsing as guest</span>
              <button className="link-btn" onClick={() => setShowAuthModal(true)}>
                Login
              </button>
            </>
          )}
        </div>

        <SearchBar onSelect={addStop} />

        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-label">Stops</span>
            <span className="stat-value">
              {stops.length}/{MAX_STOPS}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Drive time</span>
            <span className="stat-value">
              {totalDuration != null ? formatDuration(totalDuration) : "--"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Distance</span>
            <span className="stat-value">
              {totalDistance != null ? formatDistance(totalDistance) : "--"}
            </span>
          </div>
        </div>

        {error && <div className="banner banner-error">{error}</div>}
        {saved && <div className="banner banner-success">Route saved to database</div>}
        {loggedOut && <div className="banner banner-success">Logged out successfully</div>}
        {staleRoute && (
          <div className="banner banner-warning">Stops changed — click Optimize Route again</div>
        )}

        <div className="actions">
          <button className="btn btn-primary" onClick={handleOptimize} disabled={loading || stops.length < 2}>
            {loading ? (
              <span className="spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path
                  d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {loading ? "Optimizing" : "Optimize Route"}
          </button>

          {order && (
            <a
              className="btn btn-secondary"
              href={googleMapsUrl(stops, order)}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          )}

          <button className="btn btn-secondary" onClick={handleSave} disabled={!order}>
            Save Route
          </button>
          <button className="btn btn-ghost" onClick={clearStops} disabled={stops.length === 0}>
            Clear All
          </button>
        </div>

        {!order && (
          <div className="stop-list">
            <span className="section-label">Stops</span>
            <div className="stop-list-items">
              {stops.map((stop, i) => (
                <div className="stop-row" key={i}>
                  <span className={`stop-badge ${i === 0 ? "depot" : ""}`}>{i + 1}</span>
                  <span className="stop-coords" title={stop.label}>
                    {shortLabel(stop)}
                  </span>
                  <button className="stop-remove" onClick={() => removeStop(i)} aria-label="Remove stop">
                    ×
                  </button>
                </div>
              ))}
              {stops.length === 0 && (
                <p className="empty-hint">Search an address or click the map to drop a stop.</p>
              )}
            </div>
          </div>
        )}

        {order && legs && (
          <div className="stop-list">
            <span className="section-label">Journey</span>
            <div className="stop-list-items">
              {legs.map((leg, i) => (
                <div className="leg-row" key={i}>
                  <span className="stop-badge">{i + 1}</span>
                  <div className="leg-text">
                    <span title={stops[leg.from].label}>{shortLabel(stops[leg.from])}</span>
                    <span className="leg-arrow">→</span>
                    <span title={stops[leg.to].label}>{shortLabel(stops[leg.to])}</span>
                  </div>
                  <span className="leg-duration">
                    {formatDuration(leg.duration)} · {formatDistance(leg.distance)}
                  </span>
                  <button
                    className="stop-remove"
                    onClick={() => removeStop(leg.from)}
                    aria-label="Remove stop"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* last stop never appears as a leg's starting point, so it needs its own row */}
              <div className="leg-row leg-final">
                <span className="stop-badge">{legs.length + 1}</span>
                <div className="leg-text">
                  <span title={stops[order[order.length - 1]].label}>
                    {shortLabel(stops[order[order.length - 1]])}
                  </span>
                  <span className="leg-arrow">(end)</span>
                </div>
                <button
                  className="stop-remove"
                  onClick={() => removeStop(order[order.length - 1])}
                  aria-label="Remove stop"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="sidebar-resize-handle" onMouseDown={startResize} />

      <div className="map-container">
        <MapView stops={stops} order={order} onMapClick={addStop} onStopDrag={moveStop} />
      </div>

      {showAuthModal && (
        <AuthModal
          message={order ? "Login to save this route and see your history." : "Login to see your saved routes."}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(freshToken) => {
            setShowAuthModal(false);
            // only auto-save if the modal was opened because of an actual route to save -
            // logging in from the plain "Login" link shouldn't try to save an empty route
            if (order) doSave(freshToken);
          }}
        />
      )}

      {showHistory && (
        <HistoryPanel onClose={() => setShowHistory(false)} onPreview={previewRoute} />
      )}
    </div>
  );
}
