import crypto from "node:crypto";
import { pool } from "./db.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function createSession(labCode) {
  const token = crypto.randomBytes(24).toString("hex");
  await pool.query("INSERT INTO sessions (token, lab_code) VALUES ($1, $2)", [token, labCode]);
  return token;
}

export async function getSessionLabCode(token) {
  const { rows } = await pool.query("SELECT lab_code, created_at FROM sessions WHERE token = $1", [token]);
  const session = rows[0];
  if (!session) return null;
  if (Date.now() - new Date(session.created_at).getTime() > SESSION_TTL_MS) {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }
  return session.lab_code;
}

export async function destroySession(token) {
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
}

// Auth middleware: requires a valid "x-session-token" header and that the
// session belongs to the :code in the route. Attaches req.labCode on success.
export async function requireSession(req, res, next) {
  try {
    const token = req.header("x-session-token");
    const labCode = token && (await getSessionLabCode(token));
    if (!labCode) return res.status(401).json({ error: "Missing or invalid session token" });

    const routeCode = req.params.code?.trim().toLowerCase();
    if (routeCode && routeCode !== labCode) {
      return res.status(401).json({ error: "Session does not match this lab" });
    }
    req.labCode = labCode;
    next();
  } catch (err) {
    next(err);
  }
}
