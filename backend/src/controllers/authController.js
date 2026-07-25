import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

// POST /api/auth/register
export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password needs to be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    res.status(201).json({ token: signToken(user._id), user: toPublicUser(user) });
  } catch (err) {
    console.error("register failed:", err.message);
    res.status(500).json({ error: "couldn't create account", details: err.message });
  }
}

// POST /api/auth/login
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    res.json({ token: signToken(user._id), user: toPublicUser(user) });
  } catch (err) {
    console.error("login failed:", err.message);
    res.status(500).json({ error: "couldn't log in", details: err.message });
  }
}
