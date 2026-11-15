import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { errorResponse } from "../utils/errorResponse.js";

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

// req.body is whatever the client sent - an array or object here would crash
// .toLowerCase() / bcrypt further down instead of getting a clean 400.
// passwords are checked as-is (no trim) since spaces are valid password characters
const isText = (value) => typeof value === "string" && value.trim() !== "";
const isPassword = (value) => typeof value === "string" && value !== "";

// the schema already trims + lowercases on save, so lookups have to match that or
// " Someone@Mail.com" would miss the existing account
const normalizeEmail = (email) => email.trim().toLowerCase();

// POST /api/auth/register
export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!isText(name) || !isText(email) || !isPassword(password)) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password needs to be at least 6 characters" });
    }

    const existing = await User.findOne({ email: normalizeEmail(email) });
    if (existing) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    res.status(201).json({ token: signToken(user._id), user: toPublicUser(user) });
  } catch (err) {
    // two signups with the same email at the same moment can both pass the check above -
    // the unique index catches the second one, which is still just "email taken"
    if (err.code === 11000) {
      return res.status(409).json({ error: "an account with this email already exists" });
    }
    console.error("register failed:", err.message);
    res.status(500).json(errorResponse("couldn't create account", err));
  }
}

// POST /api/auth/login
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!isText(email) || !isPassword(password)) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
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
    res.status(500).json(errorResponse("couldn't log in", err));
  }
}
