import crypto from "node:crypto";

// In-memory session store: token -> { labCode, createdAt }
// Simple and enough for a single-instance deploy. If you later scale to
// multiple server instances (or want sessions to survive a restart/redeploy),
// swap this Map for a `sessions` table in Postgres (code, token, created_at)
// with the same get/create/destroy shape used below.
const sessions = new Map();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function createSession(labCode) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { labCode, createdAt: Date.now() });
  return token;
}

export function getSessionLabCode(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session.labCode;
}

export function destroySession(token) {
  sessions.delete(token);
}

// Auth middleware: requires a valid "x-session-token" header and that the
// session belongs to the :code in the route. Attaches req.labCode on success.
export function requireSession(req, res, next) {
  const token = req.header("x-session-token");
  const labCode = token && getSessionLabCode(token);
  if (!labCode) return res.status(401).json({ error: "Missing or invalid session token" });

  const routeCode = req.params.code?.trim().toLowerCase();
  if (routeCode && routeCode !== labCode) {
    return res.status(401).json({ error: "Session does not match this lab" });
  }
  req.labCode = labCode;
  next();
}
