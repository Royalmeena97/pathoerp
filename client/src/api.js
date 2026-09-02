// In production (separate frontend/backend hosting), set VITE_API_URL to
// your backend's full URL, e.g. https://apna-backend.up.railway.app/api
// If unset, falls back to a relative "/api" — this works automatically
// when the frontend is served by the same Express server (see server's
// static-file serving) or via the Vite dev proxy during local development.
const BASE = import.meta.env.VITE_API_URL || "/api";

// Session token lives in a module-level var, mirrored into sessionStorage so
// an accidental page refresh doesn't immediately log the admin out. It is
// set once on login/signup and cleared on logout.
let sessionToken = sessionStorage.getItem("pathoerp_token") || null;

function setToken(token) {
  sessionToken = token;
  if (token) sessionStorage.setItem("pathoerp_token", token);
  else sessionStorage.removeItem("pathoerp_token");
}

export function clearSession() {
  setToken(null);
}

function authHeaders() {
  return sessionToken ? { "x-session-token": sessionToken } : {};
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export function createLab({ name, city, password, securityQuestion, securityAnswer }) {
  return fetch(`${BASE}/labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, city, password, securityQuestion, securityAnswer }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

export function getSecurityQuestions() {
  return fetch(`${BASE}/security-questions`).then(handle);
}

export function getSecurityQuestion(code) {
  return fetch(`${BASE}/labs/${code}/security-question`).then(handle);
}

export function resetPassword(code, answer, newPassword) {
  return fetch(`${BASE}/labs/${code}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer, newPassword }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

export function loginLab(code, password) {
  return fetch(`${BASE}/labs/${code}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

export function listLabs() {
  return fetch(`${BASE}/labs`).then(handle);
}

export function getLabPublic(code) {
  return fetch(`${BASE}/labs/${code}/public`).then(handle);
}

// --- Admin (session-protected) calls below send the x-session-token header ---

export function getLabFull(code) {
  return fetch(`${BASE}/labs/${code}`, { headers: { ...authHeaders() } }).then(handle);
}

export function changePassword(code, currentPassword, newPassword) {
  return fetch(`${BASE}/labs/${code}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword }),
  }).then(handle);
}

export function addTest(code, payload) {
  return fetch(`${BASE}/labs/${code}/tests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function updateTest(code, testCode, payload) {
  return fetch(`${BASE}/labs/${code}/tests/${testCode}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function addPatient(code, payload) {
  return fetch(`${BASE}/labs/${code}/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function updatePatient(code, id, payload) {
  return fetch(`${BASE}/labs/${code}/patients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}
