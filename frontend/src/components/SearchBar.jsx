import { useEffect, useRef, useState } from "react";
import "./SearchBar.css";

// photon (komoot, built on osm data) - free, no api key, and tolerates typos much
// better than plain nominatim. bbox pins results to india so a typo doesn't drift
// into a same-named place in another country (e.g. "indiana gate" -> Indiana, USA)
const PHOTON_URL = "https://photon.komoot.io/api/";
const INDIA_BBOX = "68,6,98,36";

function placeLabel(props) {
  return [props.name, props.street, props.city, props.state, props.country]
    .filter(Boolean)
    .join(", ");
}

// splits a result into a bold main line and a muted "where is it" line, like map apps do
function resultLines(props) {
  const main = props.name || props.street || props.city || "Unnamed place";
  const rest = [props.street, props.city, props.state]
    .filter((part) => part && part !== main)
    .join(", ");
  return { main, rest };
}

export default function SearchBar({ onSelect, className = "", placeholder = "Search an address to add a stop" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // cancel whatever's still in flight so a slow older request can't overwrite
      // the results of a newer one that happens to come back faster
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: "5",
          lang: "en",
          bbox: INDIA_BBOX,
        });
        const res = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.features || []);
        setOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") setResults([]);
      } finally {
        // don't let an aborted (stale) request clear the loading state a newer one just set
        if (abortRef.current === controller) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handlePick(feature) {
    const [lng, lat] = feature.geometry.coordinates;
    onSelect({ lat, lng, label: placeLabel(feature.properties) });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function clearQuery() {
    abortRef.current?.abort();
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className={`search-bar ${className}`}>
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" width="15" height="15">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        aria-label="Search an address to add a stop"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && <span className="search-spinner" />}
      {!loading && query && (
        <button type="button" className="search-clear" onClick={clearQuery} aria-label="Clear search">
          ×
        </button>
      )}

      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((feature, i) => {
            const { main, rest } = resultLines(feature.properties);
            return (
              <button
                // osm ids can repeat across nodes/ways, so the index keeps keys unique
                key={`${feature.properties.osm_type}-${feature.properties.osm_id}-${i}`}
                className="search-result"
                onClick={() => handlePick(feature)}
              >
                <svg className="search-result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Z" />
                  <circle cx="12" cy="10" r="2" />
                </svg>
                <span className="search-result-text">
                  <span className="search-result-main">{main}</span>
                  {rest && <span className="search-result-rest">{rest}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
