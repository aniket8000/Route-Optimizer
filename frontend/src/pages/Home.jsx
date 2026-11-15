import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MAX_STOPS } from "../routeUtils";
// shared .btn / .brand-icon styles live in the planner's stylesheet
import "../App.css";
import "./Home.css";

// fades sections in as they scroll into view. if the browser has no
// IntersectionObserver everything just shows straight away
function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}

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

// stops in the illustration, already listed in the "optimized" visiting order
const DEMO_STOPS = [
  { x: 90, y: 300 },
  { x: 170, y: 180 },
  { x: 300, y: 120 },
  { x: 400, y: 210 },
  { x: 330, y: 320 },
];
const pathThrough = (order) => order.map((i, n) => `${n ? "L" : "M"}${DEMO_STOPS[i].x} ${DEMO_STOPS[i].y}`).join(" ");
const MESSY_PATH = pathThrough([0, 3, 1, 4, 2]); // what a "just go in the order I wrote them" day looks like
const OPTIMIZED_PATH = pathThrough([0, 1, 2, 3, 4]);

// a looping little demo: the zig-zag order fades out and the optimized route draws itself in
function RouteIllustration() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 480 420" className="hero-map">
        <defs>
          <linearGradient id="pinGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <pattern id="mapGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="480" height="420" rx="22" fill="#0f1420" />
        <rect width="480" height="420" rx="22" fill="url(#mapGrid)" />

        {/* a few faint "roads" so it reads as a map */}
        <g className="hero-roads">
          <path d="M-10 250 C 120 230, 200 300, 490 260" />
          <path d="M140 -10 C 160 120, 120 260, 180 430" />
          <path d="M-10 90 C 150 120, 330 40, 490 110" />
          <path d="M360 -10 C 340 140, 420 260, 380 430" />
        </g>

        <path d={MESSY_PATH} className="hero-route-messy" />
        <path d={OPTIMIZED_PATH} className="hero-route-shadow" pathLength="1" />
        <path d={OPTIMIZED_PATH} className="hero-route" pathLength="1" />

        {/* outer g positions the pin, inner g animates - a css transform on the same
            element would wipe out the svg translate */}
        {DEMO_STOPS.map((stop, i) => (
          <g key={i} transform={`translate(${stop.x} ${stop.y})`}>
            <g className="hero-pin" style={{ "--delay": `${i * 0.12}s` }}>
              {i === 0 && <circle r="22" className="hero-pin-pulse" />}
              <circle r="14" fill={i === 0 ? "#22c55e" : "url(#pinGradient)"} stroke="#0b0e14" strokeWidth="3" />
              <text textAnchor="middle" dy="4.5">
                {i + 1}
              </text>
            </g>
          </g>
        ))}
      </svg>

      <div className="hero-chip">
        <span className="hero-chip-dot" />
        Fastest order found
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Add your stops",
    text: `Search an address or tap the map. Add up to ${MAX_STOPS} stops — the first one is where you start.`,
  },
  {
    title: "Get the fastest order",
    text: "Route Optimizer checks real driving times between every stop and works out the quickest order to visit them all.",
  },
  {
    title: "Start driving",
    text: "See the time and distance for each leg, then open the whole route in Google Maps for turn-by-turn directions.",
  },
];

const FEATURES = [
  {
    title: "Real road times",
    text: "Times and distances come from the actual road network, not straight lines on a map.",
    icon: <path d="M4 19 9 5M15 5l5 14M12 6v2M12 11v2M12 16v2" />,
  },
  {
    title: "Drag to fix a stop",
    text: "Dropped a pin in the wrong spot? Drag it to the right place instead of searching again.",
    icon: (
      <>
        <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
  },
  {
    title: "Stop-by-stop breakdown",
    text: "Drive time and distance for every leg of the trip, plus the total for the whole route.",
    icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  },
  {
    title: "Save your routes",
    text: "Log in to save a route and open it again later. Planning a route never needs an account.",
    icon: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  },
];

export default function Home() {
  const pageRef = useReveal();

  useEffect(() => {
    document.title = "Route Optimizer — plan the fastest delivery route";
  }, []);

  function scrollToHowItWorks(e) {
    e.preventDefault();
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="home" ref={pageRef}>
      <div className="home-glow" aria-hidden="true" />

      <header className="home-nav">
        <Link to="/" className="home-brand">
          <span className="brand-icon">
            <BrandIcon />
          </span>
          Route Optimizer
        </Link>
        <nav className="home-nav-links">
          <a href="#how-it-works" className="home-nav-link" onClick={scrollToHowItWorks}>
            How it works
          </a>
          <Link to="/plan" className="btn btn-primary home-nav-cta">
            Open map
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow">For delivery riders &amp; drivers</span>
            <h1>
              Stop guessing your <span className="gradient-text">delivery order.</span>
            </h1>
            <p className="hero-lead">
              Add all your drop-off points and Route Optimizer finds the fastest order to visit them, using
              real road driving times. Then open the route in Google Maps and go.
            </p>
            <div className="hero-actions">
              <Link to="/plan" className="btn btn-primary btn-lg">
                Plan my route
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18" className="btn-arrow">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#how-it-works" className="btn btn-secondary btn-lg" onClick={scrollToHowItWorks}>
                How it works
              </a>
            </div>
            <p className="hero-note">Free to use · No sign-up needed to plan a route</p>
          </div>

          <RouteIllustration />
        </section>

        <section className="home-section" id="how-it-works">
          <div className="section-head reveal">
            <span className="section-kicker">How it works</span>
            <h2>Three steps to a better route</h2>
          </div>
          <div className="steps">
            {STEPS.map((step, i) => (
              <article className="step-card reveal" key={step.title} style={{ "--delay": `${i * 0.1}s` }}>
                <span className="step-number">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="section-head reveal">
            <span className="section-kicker">Built for the road</span>
            <h2>Everything you need, nothing you don't</h2>
          </div>
          <div className="features">
            {FEATURES.map((feature, i) => (
              <article className="feature-card reveal" key={feature.title} style={{ "--delay": `${i * 0.08}s` }}>
                <span className="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {feature.icon}
                  </svg>
                </span>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="cta-band reveal">
            <h2>Got deliveries today?</h2>
            <p>Add your stops and let the map work out the order.</p>
            <Link to="/plan" className="btn btn-primary btn-lg">
              Open the map
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Route Optimizer</span>
        <span>
          Map data ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{" "}
          contributors
        </span>
      </footer>
    </div>
  );
}
