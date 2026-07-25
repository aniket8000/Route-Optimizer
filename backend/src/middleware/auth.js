import jwt from "jsonwebtoken";

// protects a route - reads "Authorization: Bearer <token>", verifies it,
// and sticks the user id on req.userId so controllers can use it
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "login required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "session expired, please login again" });
  }
}
