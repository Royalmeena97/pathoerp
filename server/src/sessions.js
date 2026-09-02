import crypto from "node:crypto";
import { pool } from "./db.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// role is 'admin' (the lab owner) or 'staff' (a receptionist-style account
// created by the owner, see /api/labs/:code/staff). staffId is set only for
// staff sessions.
export async function createSession(labCode, role = "admin", staffId = null) {
  const token = crypto.randomBytes(24).toString("hex");
  await pool.query(
    "INSERT INTO sessions (token, lab_code, role, staff_id) VALUES ($1, $2, $3, $4)",
    [token, labCode, role, staffId]
  );
  return token;
}

export async function getSessionInfo(token) {
  const { rows } = await pool.query(
    "SELECT lab_code, role, staff_id, created_at FROM sessions WHERE token = $1",
    [token]
  );
  const session = rows[0];
  if (!session) return null;
  if (Date.now() - new Date(session.created_at).getTime() > SESSION_TTL_MS) {
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }
  return { labCode: session.lab_code, role: session.role, staffId: session.staff_id };
}

export async function destroySession(token) {
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
}

// Auth middleware: requires a valid "x-session-token" header and that the
// session belongs to the :code in the route. Attaches req.labCode,
// req.sessionRole ('admin' | 'staff') and req.staffId.
export async function requireSession(req, res, next) {
  try {
    const token = req.header("x-session-token");
    const info = token && (await getSessionInfo(token));
    if (!info) return res.status(401).json({ error: "Missing or invalid session token" });

    const routeCode = req.params.code?.trim().toLowerCase();
    if (routeCode && routeCode !== info.labCode) {
      return res.status(401).json({ error: "Session does not match this lab" });
    }
    req.labCode = info.labCode;
    req.sessionRole = info.role;
    req.staffId = info.staffId;
    next();
  } catch (err) {
    next(err);
  }
}

// Chain after requireSession on routes only the lab owner should reach
// (billing settings, password, staff management, test pricing).
export function requireAdmin(req, res, next) {
  if (req.sessionRole !== "admin") {
    return res.status(403).json({ error: "This action is only available to the lab owner" });
  }
  next();
}
