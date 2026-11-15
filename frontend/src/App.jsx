import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import AuthModal from "./components/AuthModal";
import HistoryPanel from "./components/HistoryPanel";
import BottomSheet from "./components/BottomSheet";
import { optimizeRoute, saveRoute, isSessionExpired } from "./api";
import { useAuth } from "./context/useAuth";
import { shortLabel, formatDuration, formatDistance, googleMapsUrl, MAX_STOPS } from "./routeUtils";
import "./App.css";

// height of the floating search bar on mobile, so the map can keep pins out from under it
const MOBILE_TOPBAR_SPACE = 76;

function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12h4l2-7 4 14 2-7h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const resizingRef = useRef(false);

  // mobile bottom sheet: whether it's pulled up, and how much screen it covers when it isn't
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetPeek, setSheetPeek] = useState(220);

  // desktop gets the resizable sidebar, phones/small tablets get a full-screen map with a
  // bottom sheet - two different layouts, so this decides which one to render
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 769px)").matches);

  useEffect(() => {
    document.title = "Plan a route · Route Optimizer";
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  function showToast(message) {
    clearTimeout(toastTimerRef.current);
    setToast({ message, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }

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
    showToast("Logged out");
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
      // on a phone, drop the sheet down so the freshly drawn route is actually visible
      setSheetExpanded(false);
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
      showToast("Route saved");
    } catch (err) {
      // token ran out (they last 30 days) - drop the stale login and ask again, but keep
      // the route on screen so it gets saved automatically once they log back in
      if (isSessionExpired(err)) {
        handleSessionExpired();
        return;
      }
      setError(err.response?.data?.error || err.message);
    }
  }

  function handleSessionExpired() {
    logout();
    setShowHistory(false);
    setError("your session expired, please login again");
    setShowAuthModal(true);
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
    setSheetExpanded(false);
  }

  // ---------- pieces shared by the desktop sidebar and the mobile bottom sheet ----------

  const accountRow = (
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
  );

  // keyed on the value so it re-runs the little pop animation each time a number changes
  const stats = (
    <div className="stat-row">
      <div className="stat-card">
        <span className="stat-label">Stops</span>
        <span className="stat-value" key={`s${stops.length}`}>
          {stops.length}/{MAX_STOPS}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Drive time</span>
        <span className="stat-value" key={`t${totalDuration}`}>
          {totalDuration != null ? formatDuration(totalDuration) : "--"}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Distance</span>
        <span className="stat-value" key={`d${totalDistance}`}>
          {totalDistance != null ? formatDistance(totalDistance) : "--"}
        </span>
      </div>
    </div>
  );

  const banners = (
    <>
      {error && <div className="banner banner-error">{error}</div>}
      {staleRoute && <div className="banner banner-warning">Stops changed — click Optimize Route again</div>}
    </>
  );

  const optimizeButton = (
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
  );

  const mapsLink = order && (
    <a className="btn btn-secondary" href={googleMapsUrl(stops, order)} target="_blank" rel="noreferrer">
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-8-8 18-2-8-8-2Z" />
      </svg>
      {isDesktop ? "Open in Google Maps" : "Google Maps"}
    </a>
  );

  const saveButton = (
    <button className="btn btn-secondary" onClick={handleSave} disabled={!order || saved}>
      {saved ? "Saved ✓" : "Save Route"}
    </button>
  );

  const clearButton = (
    <button className="btn btn-ghost" onClick={clearStops} disabled={stops.length === 0}>
      Clear All
    </button>
  );

  const stopList = (
    <>
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
            {stops.length === 0 && <p className="empty-hint">Search an address or tap the map to drop a stop.</p>}
          </div>
        </div>
      )}

      {order && legs && (
        <div className="stop-list">
          <span className="section-label">Journey</span>
          <div className="stop-list-items">
            {legs.map((leg, i) => (
              <div className="leg-row" key={i}>
                <span className={`stop-badge ${i === 0 ? "depot" : ""}`}>{i + 1}</span>
                <div className="leg-text">
                  <span title={stops[leg.from].label}>{shortLabel(stops[leg.from])}</span>
                  <span className="leg-arrow">→</span>
                  <span title={stops[leg.to].label}>{shortLabel(stops[leg.to])}</span>
                </div>
                <span className="leg-duration">
                  {formatDuration(leg.duration)} · {formatDistance(leg.distance)}
                </span>
                <button className="stop-remove" onClick={() => removeStop(leg.from)} aria-label="Remove stop">
                  ×
                </button>
              </div>
            ))}

            {/* last stop never appears as a leg's starting point, so it needs its own row */}
            <div className="leg-row leg-final">
              <span className="stop-badge">{legs.length + 1}</span>
              <div className="leg-text">
                <span title={stops[order[order.length - 1]].label}>{shortLabel(stops[order[order.length - 1]])}</span>
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
    </>
  );

  // small hints floating over the map - what to do next, and a "working on it" pill
  const mapHint = loading ? (
    <div className="map-pill map-pill-busy" role="status">
      <span className="spinner" />
      Finding the fastest order…
    </div>
  ) : stops.length === 0 ? (
    <div className="map-pill">Tap the map or search to add your first stop</div>
  ) : stops.length === 1 ? (
    <div className="map-pill">Add one more stop to optimize</div>
  ) : null;

  const modals = (
    <>
      {showAuthModal && (
        <AuthModal
          message={order ? "Login to save this route and see your history." : "Login to see your saved routes."}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(freshToken) => {
            setShowAuthModal(false);
            setError(null); // clears a leftover "session expired" banner
            // only auto-save if the modal was opened because of an actual route to save -
            // logging in from the plain "Login" link shouldn't try to save an empty route
            if (order) doSave(freshToken);
          }}
        />
      )}

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onPreview={previewRoute}
          onSessionExpired={handleSessionExpired}
        />
      )}

      {toast && (
        <div className="toast" key={toast.id} role="status">
          <span className="toast-dot" />
          {toast.message}
        </div>
      )}
    </>
  );

  if (!isDesktop) {
    return (
      <div className="app app-mobile" style={{ "--sheet-peek": `${sheetPeek}px` }}>
        <div className="map-container">
          <MapView
            stops={stops}
            order={order}
            onMapClick={addStop}
            onStopDrag={moveStop}
            insets={{ top: MOBILE_TOPBAR_SPACE, bottom: sheetPeek }}
          />
          {mapHint}
        </div>

        <header className="mobile-topbar">
          <Link to="/" className="mobile-icon-btn brand-icon" aria-label="Back to home">
            <BrandIcon />
          </Link>
          <SearchBar className="is-floating" onSelect={addStop} placeholder="Search an address" />
          <button
            type="button"
            className="mobile-icon-btn mobile-account-btn"
            onClick={() => (user ? setShowHistory(true) : setShowAuthModal(true))}
            aria-label={user ? "My saved routes" : "Login"}
            title={user ? "My saved routes" : "Login"}
          >
            {user ? (
              user.name.trim().charAt(0).toUpperCase()
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
              </svg>
            )}
          </button>
        </header>

        <BottomSheet
          expanded={sheetExpanded}
          onExpandedChange={setSheetExpanded}
          onPeekHeightChange={setSheetPeek}
          peek={
            <>
              {stats}
              {banners}
              <div className="sheet-actions">
                {optimizeButton}
                {mapsLink}
              </div>
            </>
          }
        >
          <div className="sheet-actions-secondary">
            {saveButton}
            {clearButton}
          </div>
          {accountRow}
          {stopList}
        </BottomSheet>

        {modals}
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar" style={{ width: sidebarWidth }}>
        <Link to="/" className="brand" title="Back to home">
          <div className="brand-icon">
            <BrandIcon />
          </div>
          <div>
            <h1>Route Optimizer</h1>
            <p className="subtitle">TSP solver for delivery routes</p>
          </div>
        </Link>

        {accountRow}
        <SearchBar onSelect={addStop} />
        {stats}
        {banners}

        <div className="actions">
          {optimizeButton}
          {mapsLink}
          {saveButton}
          {clearButton}
        </div>

        {stopList}
      </aside>

      <div className="sidebar-resize-handle" onMouseDown={startResize} />

      <div className="map-container">
        <MapView stops={stops} order={order} onMapClick={addStop} onStopDrag={moveStop} />
        {mapHint}
      </div>

      {modals}
    </div>
  );
}
