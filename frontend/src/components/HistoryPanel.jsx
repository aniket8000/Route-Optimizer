import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { listRoutes, deleteRoute, isSessionExpired } from "../api";
import { formatDuration, formatDistance, googleMapsUrl, shortLabel } from "../routeUtils";
import "./AuthModal.css";
import "./HistoryPanel.css";

export default function HistoryPanel({ onClose, onPreview, onSessionExpired }) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // an expired login gets handed up to App (logs out + shows the login modal)
  // instead of showing a dead-end error inside this panel
  function handleError(err) {
    if (isSessionExpired(err)) {
      onSessionExpired();
      return;
    }
    setError(err.response?.data?.error || err.message);
  }

  useEffect(() => {
    listRoutes(token)
      .then(setRoutes)
      .catch(handleError)
      .finally(() => setLoading(false));
    // handleError only reads props, re-running this on every render isn't wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleDelete(id) {
    try {
      await deleteRoute(id, token);
      setRoutes((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2>Saved routes</h2>

        {error && <div className="banner banner-error">{error}</div>}

        {/* grey placeholder cards while the list loads, instead of a bare "Loading..." */}
        {loading && (
          <div className="history-list" aria-busy="true" aria-label="Loading saved routes">
            <div className="history-skeleton" />
            <div className="history-skeleton" />
          </div>
        )}

        {!loading && !error && routes.length === 0 && (
          <div className="history-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12v18l-6-4-6 4V3Z" />
            </svg>
            <p className="modal-message">No saved routes yet — optimize one and hit Save Route.</p>
          </div>
        )}

        <div className="history-list">
          {routes.map((route, i) => (
            <div className="history-item" key={route._id} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
              <div className="history-item-header">
                <span className="history-item-title">{route.driverName || "Route"}</span>
                <span className="history-item-time">
                  {formatDuration(route.totalDuration)} · {formatDistance(route.totalDistance)}
                </span>
              </div>
              <div className="history-item-meta">
                {route.stops.length} stops · {new Date(route.createdAt).toLocaleString()}
              </div>

              <div className="history-stop-sequence">
                {route.order.map((stopIdx, i) => (
                  <div className="history-stop" key={i}>
                    <span className="stop-badge">{i + 1}</span>
                    <span title={route.stops[stopIdx].label}>{shortLabel(route.stops[stopIdx])}</span>
                  </div>
                ))}
              </div>

              <div className="history-item-actions">
                <button className="btn btn-secondary" onClick={() => onPreview(route)}>
                  Preview on map
                </button>
                <a
                  className="btn btn-secondary"
                  href={googleMapsUrl(route.stops, route.order)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Maps
                </a>
                <button
                  className="btn btn-ghost history-delete"
                  onClick={() => handleDelete(route._id)}
                  aria-label="Delete route"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
