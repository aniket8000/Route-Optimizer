import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listRoutes, deleteRoute } from "../api";
import { formatDuration, formatDistance, googleMapsUrl, shortLabel } from "../routeUtils";
import "./AuthModal.css";
import "./HistoryPanel.css";

export default function HistoryPanel({ onClose, onPreview }) {
  const { token } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listRoutes(token)
      .then(setRoutes)
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(id) {
    try {
      await deleteRoute(id, token);
      setRoutes((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2>Saved routes</h2>

        {loading && <p className="modal-message">Loading...</p>}
        {error && <div className="banner banner-error">{error}</div>}

        {!loading && !error && routes.length === 0 && (
          <p className="modal-message">No saved routes yet — optimize one and hit Save Route.</p>
        )}

        <div className="history-list">
          {routes.map((route) => (
            <div className="history-item" key={route._id}>
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
