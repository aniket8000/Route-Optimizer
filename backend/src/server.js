import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import routeRoutes from "./routes/routeRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// comma-separated list so it's easy to add a deployed frontend url later without a code change.
// trimmed (and trailing slash dropped) because "a.com, b.com" or "a.com/" would otherwise
// never match the browser's Origin header and silently block the site
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/routes", routeRoutes);

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
